"""Tests for recent Agent SDK bug fixes.

Covers:

- `to_json_str` / `to_text` helpers — protocol-safe serialisation of
  Pydantic models, dataclasses, and other non-JSON-native values.
- `parent_span_id` / `parent_span_id` override semantics on
  ``Agent.run`` — explicit value overrides ambient trace context.
- Tool output Pydantic / dataclass values survive the agent loop via
  ``_append_tool_results``.
- ``Agent.model`` now accepts a fallback-chain list.
"""

from __future__ import annotations

import dataclasses
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opperai._context import TraceContext, set_trace_context
from opperai.agent import Agent
from opperai.agent._loop import _append_tool_results
from opperai.agent._serialize import to_json_str, to_text
from opperai.agent._types import (
    AggregatedUsage,
    RunMeta,
    RunResult,
    ToolCallRecord,
)


@pytest.fixture(autouse=True)
def _clear_trace_context() -> Any:
    set_trace_context(None)
    yield
    set_trace_context(None)


# ---------------------------------------------------------------------------
# to_json_str / to_text
# ---------------------------------------------------------------------------


class _FakePydanticModel:
    """Minimal duck-typed Pydantic v2 surface — no dependency on pydantic."""

    def __init__(self, **fields: Any) -> None:
        self._fields = fields

    def model_dump(self) -> dict[str, Any]:
        return dict(self._fields)

    def model_dump_json(self) -> str:
        return json.dumps(self._fields)


@dataclasses.dataclass
class _Point:
    x: int
    y: int


class _Unserialisable:
    def __repr__(self) -> str:
        return "<Unserialisable>"


class TestToJsonStr:
    def test_pydantic_instance_round_trips(self) -> None:
        obj = _FakePydanticModel(name="Alice", age=30)
        parsed = json.loads(to_json_str(obj))
        assert parsed == {"name": "Alice", "age": 30}

    def test_dataclass_round_trips(self) -> None:
        parsed = json.loads(to_json_str(_Point(1, 2)))
        assert parsed == {"x": 1, "y": 2}

    def test_dict_round_trips(self) -> None:
        parsed = json.loads(to_json_str({"a": 1, "b": [2, 3]}))
        assert parsed == {"a": 1, "b": [2, 3]}

    def test_raw_string_is_quoted(self) -> None:
        # Protocol callers need valid JSON — a bare string must be quoted.
        assert to_json_str("ok") == '"ok"'
        assert json.loads(to_json_str("ok")) == "ok"

    def test_none_is_valid_json(self) -> None:
        assert to_json_str(None) == "null"

    def test_unserialisable_falls_back_to_repr(self) -> None:
        # Must never raise — returns a valid JSON string containing the repr.
        out = to_json_str(_Unserialisable())
        assert json.loads(out) == "<Unserialisable>"


class TestToText:
    def test_raw_string_passes_through(self) -> None:
        assert to_text("hello") == "hello"

    def test_none_is_empty_string(self) -> None:
        assert to_text(None) == ""

    def test_pydantic_becomes_json(self) -> None:
        assert to_text(_FakePydanticModel(k="v")) == '{"k": "v"}'

    def test_dict_becomes_json(self) -> None:
        assert json.loads(to_text({"a": 1})) == {"a": 1}


# ---------------------------------------------------------------------------
# Tool output: Pydantic/dataclass reaches function_call_output.output intact
# ---------------------------------------------------------------------------


class TestAppendToolResults:
    def test_pydantic_tool_output_survives(self) -> None:
        items: list[dict[str, Any]] = []
        record = ToolCallRecord(
            name="fetch_user",
            call_id="fc_0",
            input={"id": 1},
            output=_FakePydanticModel(id=1, name="Alice"),
            duration_ms=1.0,
        )
        _append_tool_results(items, [{"call_id": "fc_0", "name": "fetch_user", "arguments": "{}"}], [record])

        [call_item, output_item] = items
        assert call_item["type"] == "function_call"
        assert output_item["type"] == "function_call_output"
        # The output field must be a valid JSON string the server can parse.
        assert json.loads(output_item["output"]) == {"id": 1, "name": "Alice"}

    def test_dataclass_tool_output_survives(self) -> None:
        items: list[dict[str, Any]] = []
        record = ToolCallRecord(
            name="xy",
            call_id="fc_1",
            input={},
            output=_Point(3, 4),
            duration_ms=0.5,
        )
        _append_tool_results(items, [{"call_id": "fc_1", "name": "xy", "arguments": "{}"}], [record])
        assert json.loads(items[1]["output"]) == {"x": 3, "y": 4}

    def test_error_output_is_valid_json(self) -> None:
        items: list[dict[str, Any]] = []
        record = ToolCallRecord(
            name="broken",
            call_id="fc_2",
            input={},
            output=None,
            error="boom",
            duration_ms=0.1,
        )
        _append_tool_results(items, [{"call_id": "fc_2", "name": "broken", "arguments": "{}"}], [record])
        assert json.loads(items[1]["output"]) == {"error": "boom"}


# ---------------------------------------------------------------------------
# parent_span_id wiring + override semantics
# ---------------------------------------------------------------------------


def _mk_agent_with_mocked_spans(**agent_kwargs: Any) -> tuple[Agent, MagicMock]:
    agent = Agent(
        name="test-agent",
        instructions="Be helpful.",
        client={"api_key": "test-key"},
        tracing=True,
        **agent_kwargs,
    )
    mock_span = MagicMock()
    mock_span.id = "agent-span"
    mock_span.trace_id = "agent-trace"
    assert agent._spans_client is not None
    agent._spans_client.create_async = AsyncMock(return_value=mock_span)
    agent._spans_client.update_async = AsyncMock()
    return agent, agent._spans_client.create_async


class TestParentSpanId:
    @pytest.mark.asyncio
    async def test_explicit_parent_span_id_is_honoured(self) -> None:
        agent, create_mock = _mk_agent_with_mocked_spans()

        mock_result = RunResult(
            output="ok",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=1), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            await agent.run("hi", parent_span_id="user-span-1")

        kwargs = create_mock.call_args[1]
        assert kwargs["parent_id"] == "user-span-1"
        # Explicit parent → no ambient trace_id merged in.
        assert kwargs.get("trace_id") is None

    @pytest.mark.asyncio
    async def test_explicit_parent_overrides_ambient(self) -> None:
        set_trace_context(TraceContext(span_id="amb-span", trace_id="amb-trace"))
        agent, create_mock = _mk_agent_with_mocked_spans()

        mock_result = RunResult(
            output="ok",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=1), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            await agent.run("hi", parent_span_id="explicit-span")

        kwargs = create_mock.call_args[1]
        assert kwargs["parent_id"] == "explicit-span"
        # Must NOT leak ambient trace_id — explicit parent may be on a
        # different trace.
        assert kwargs.get("trace_id") is None

    @pytest.mark.asyncio
    async def test_no_explicit_uses_ambient(self) -> None:
        set_trace_context(TraceContext(span_id="amb-span", trace_id="amb-trace"))
        agent, create_mock = _mk_agent_with_mocked_spans()

        mock_result = RunResult(
            output="ok",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=1), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            await agent.run("hi")

        kwargs = create_mock.call_args[1]
        assert kwargs["parent_id"] == "amb-span"
        assert kwargs["trace_id"] == "amb-trace"


# ---------------------------------------------------------------------------
# Pydantic output_schema: span end_time written (BUG-4 user-visible symptom)
# ---------------------------------------------------------------------------


class TestPydanticSpanEndTime:
    @pytest.mark.asyncio
    async def test_end_time_set_when_output_is_pydantic_instance(self) -> None:
        agent, _ = _mk_agent_with_mocked_spans()

        mock_result = RunResult(
            output=_FakePydanticModel(answer=42),
            meta=RunMeta(usage=AggregatedUsage(total_tokens=10), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            await agent.run("What is the answer?")

        assert agent._spans_client is not None
        agent._spans_client.update_async.assert_called_once()
        update_kwargs = agent._spans_client.update_async.call_args[1]
        # end_time must be written (previously swallowed by the json.dumps TypeError).
        assert "end_time" in update_kwargs
        # And output must be parseable JSON matching the Pydantic fields.
        assert json.loads(update_kwargs["output"]) == {"answer": 42}


# ---------------------------------------------------------------------------
# model fallback chain flows through LoopConfig
# ---------------------------------------------------------------------------


class TestAsToolKwargInvocation:
    """`_execute_tool` unpacks dict args as kwargs (``tool.execute(**parsed)``).

    The ``as_tool`` wrapper must accept ``input=`` as a keyword argument or the
    whole sub-agent call errors with
    ``TypeError: execute() got an unexpected keyword argument 'input'``.
    """

    @pytest.mark.asyncio
    async def test_as_tool_accepts_input_kwarg(self) -> None:
        child = Agent(
            name="child",
            instructions="be brief",
            client={"api_key": "k"},
            tracing=False,
        )

        mock_result = RunResult(
            output="sub-answer",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=5), iterations=1),
        )
        with patch.object(child, "run", new_callable=AsyncMock, return_value=mock_result) as run_mock:
            wrapped = child.as_tool(name="delegate", description="sub")
            # Simulate how _execute_tool invokes tools: **parsed for dict args.
            result = await wrapped.execute(**{"input": "hi there"})

        run_mock.assert_awaited_once_with("hi there")
        assert result["output"] == '"sub-answer"'


class TestModelFallback:
    def test_list_model_preserved_through_loop_config(self) -> None:
        agent = Agent(
            name="fallback-test",
            instructions="x",
            model=["anthropic/claude-haiku-4-5", "arcee/trinity-mini"],
            client={"api_key": "test-key"},
            tracing=False,
        )
        config = agent._build_loop_config([])
        assert config.model == ["anthropic/claude-haiku-4-5", "arcee/trinity-mini"]

    def test_model_config_dict_preserved(self) -> None:
        agent = Agent(
            name="mc-test",
            instructions="x",
            model={"name": "anthropic/claude-haiku-4-5", "options": {"thinking": {"budget_tokens": 1024}}},
            client={"api_key": "test-key"},
            tracing=False,
        )
        config = agent._build_loop_config([])
        assert isinstance(config.model, dict)
        assert config.model["name"] == "anthropic/claude-haiku-4-5"
