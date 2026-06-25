"""Tests for structured-output robustness fixes in the agent loop.

Covers:
  - ``use_tool_fallback`` honoring ``mode="tool"`` for tool-less agents.
  - ``_extract_text`` concatenating every output_text part.
  - tolerant JSON parsing (fences, embedded object/array).
  - truncation detection + diagnostic AgentError when a schema is set but
    the model returns nothing parseable.
  - a 16k default ``max_output_tokens`` when the caller sets none.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import patch

import pytest

from opperai.agent import Agent
from opperai.agent._errors import AgentError
from opperai.agent._loop import (
    DEFAULT_MAX_OUTPUT_TOKENS,
    LoopConfig,
    _build_request,
    _detect_truncation,
    _extract_text,
    _try_parse_json,
)
from opperai.agent._models import use_tool_fallback

SCHEMA = {
    "type": "object",
    "properties": {"answer": {"type": "string"}},
    "required": ["answer"],
}


# ---------------------------------------------------------------------------
# use_tool_fallback ordering (P0)
# ---------------------------------------------------------------------------


class TestUseToolFallbackOrdering:
    def test_tool_mode_forces_fallback_without_tools(self) -> None:
        # Explicit "tool" must force the fallback even with no tools — the
        # has_tools guard previously short-circuited this to False.
        assert use_tool_fallback(
            model="openai/gpt-4o", has_tools=False, has_output_schema=True, mode="tool"
        ) is True

    def test_auto_mode_still_requires_tools(self) -> None:
        assert use_tool_fallback(
            model="mistral/x", has_tools=False, has_output_schema=True, mode="auto"
        ) is False

    def test_no_schema_never_falls_back(self) -> None:
        assert use_tool_fallback(
            model="mistral/x", has_tools=True, has_output_schema=False, mode="tool"
        ) is False

    def test_native_mode_disables_even_without_tools(self) -> None:
        assert use_tool_fallback(
            model="mistral/x", has_tools=False, has_output_schema=True, mode="native"
        ) is False


# ---------------------------------------------------------------------------
# _extract_text (P1)
# ---------------------------------------------------------------------------


class TestExtractText:
    def test_concatenates_parts_within_a_message(self) -> None:
        output = [
            {
                "type": "message",
                "role": "assistant",
                "content": [
                    {"type": "output_text", "text": '{"ans'},
                    {"type": "output_text", "text": 'wer": "42"}'},
                ],
            }
        ]
        assert _extract_text(output) == '{"answer": "42"}'

    def test_concatenates_across_messages(self) -> None:
        output = [
            {"type": "message", "role": "assistant",
             "content": [{"type": "output_text", "text": "a"}]},
            {"type": "message", "role": "assistant",
             "content": [{"type": "output_text", "text": "b"}]},
        ]
        assert _extract_text(output) == "ab"

    def test_none_when_no_text(self) -> None:
        output = [{"type": "reasoning", "content": []}]
        assert _extract_text(output) is None


# ---------------------------------------------------------------------------
# Tolerant JSON parsing (P1)
# ---------------------------------------------------------------------------


class TestTryParseJson:
    def test_plain_json(self) -> None:
        assert _try_parse_json('{"answer": "42"}') == (True, {"answer": "42"})

    def test_markdown_fenced(self) -> None:
        text = '```json\n{"answer": "42"}\n```'
        assert _try_parse_json(text) == (True, {"answer": "42"})

    def test_leading_prose(self) -> None:
        text = 'Here is the result:\n{"answer": "42"}'
        assert _try_parse_json(text) == (True, {"answer": "42"})

    def test_array_span(self) -> None:
        assert _try_parse_json("output: [1, 2, 3]") == (True, [1, 2, 3])

    def test_braces_inside_strings_dont_break_span(self) -> None:
        assert _try_parse_json('{"a": "}{"}') == (True, {"a": "}{"})

    def test_truncated_json_fails(self) -> None:
        assert _try_parse_json('{"answer": "4') == (False, None)

    def test_empty_and_none(self) -> None:
        assert _try_parse_json("") == (False, None)
        assert _try_parse_json(None) == (False, None)


# ---------------------------------------------------------------------------
# Truncation detection (P1)
# ---------------------------------------------------------------------------


class TestDetectTruncation:
    def test_status_incomplete(self) -> None:
        resp = {"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"}}
        reason = _detect_truncation(resp, None)
        assert reason is not None and "incomplete" in reason and "max_output_tokens" in reason

    def test_output_tokens_reaches_cap(self) -> None:
        # Defends against a gateway reporting status=completed on a cutoff.
        # Uses this response's usage, not the cumulative run total.
        resp = {"status": "completed", "usage": {"output_tokens": 4096}}
        reason = _detect_truncation(resp, 4096)
        assert reason is not None and "4096" in reason

    def test_no_truncation(self) -> None:
        resp = {"status": "completed", "usage": {"output_tokens": 50}}
        assert _detect_truncation(resp, 4096) is None


# ---------------------------------------------------------------------------
# Default max_output_tokens (P2)
# ---------------------------------------------------------------------------


def _config(**overrides: Any) -> LoopConfig:
    base: dict[str, Any] = {
        "name": "t",
        "trace_name": "t",
        "instructions": "i",
        "tools": [],
    }
    base.update(overrides)
    return LoopConfig(**base)


class TestDefaultMaxTokens:
    def test_default_applied_when_unset(self) -> None:
        req = _build_request(_config(), items=[], or_tools=[])
        assert req["max_output_tokens"] == DEFAULT_MAX_OUTPUT_TOKENS

    def test_explicit_value_wins(self) -> None:
        req = _build_request(_config(max_tokens=500), items=[], or_tools=[])
        assert req["max_output_tokens"] == 500


# ---------------------------------------------------------------------------
# Loop integration: schema set but model returns nothing parseable (P0)
# ---------------------------------------------------------------------------


class _StubStream:
    def __init__(self, events: list[dict[str, Any]]) -> None:
        self._events = events

    async def __aiter__(self) -> AsyncIterator[dict[str, Any]]:
        for ev in self._events:
            yield ev


def _agent(**overrides: Any) -> Agent:
    base: dict[str, Any] = {
        "name": "so-agent",
        "instructions": "answer",
        "model": "openai/gpt-4o",  # native path, no tool fallback
        "output_schema": SCHEMA,
        "tracing": False,
        "client": {"api_key": "test", "base_url": "http://test"},
    }
    base.update(overrides)
    return Agent(**base)


def _completed(*, text: str | None = None, **resp: Any) -> dict[str, Any]:
    output: list[dict[str, Any]] = []
    if text is not None:
        output.append({
            "type": "message",
            "role": "assistant",
            "content": [{"type": "output_text", "text": text}],
        })
    response = {
        "id": "resp_1",
        "status": "completed",
        "output": output,
        "usage": {"input_tokens": 1, "output_tokens": 1, "total_tokens": 2},
    }
    response.update(resp)
    return {"type": "response.completed", "response": response}


@pytest.mark.asyncio
async def test_reasoning_only_response_raises() -> None:
    agent = _agent()
    events = [_completed(text=None)]  # no output_text at all

    async def factory(*_a: Any, **_kw: Any) -> Any:
        return _StubStream(events).__aiter__()

    with patch.object(agent._or_client, "create_stream_async", side_effect=factory):
        with pytest.raises(AgentError, match="did not return a parseable"):
            await agent.run("q")


@pytest.mark.asyncio
async def test_truncated_json_raises_with_truncation_hint() -> None:
    agent = _agent()
    # output_tokens hits the cap and status mislabeled completed → truncation.
    events = [
        _completed(
            text='{"answer": "the meaning of',
            status="incomplete",
            incomplete_details={"reason": "max_output_tokens"},
            usage={"input_tokens": 1, "output_tokens": 4096, "total_tokens": 4097},
        )
    ]

    async def factory(*_a: Any, **_kw: Any) -> Any:
        return _StubStream(events).__aiter__()

    with patch.object(agent._or_client, "create_stream_async", side_effect=factory):
        with pytest.raises(AgentError, match="truncated"):
            await agent.run("q")


@pytest.mark.asyncio
async def test_fenced_json_is_rescued() -> None:
    agent = _agent()
    events = [_completed(text='```json\n{"answer": "42"}\n```')]

    async def factory(*_a: Any, **_kw: Any) -> Any:
        return _StubStream(events).__aiter__()

    with patch.object(agent._or_client, "create_stream_async", side_effect=factory):
        result = await agent.run("q")

    assert result.output == {"answer": "42"}
