"""Tests for the structured-output-via-tool fallback in the agent loop.

When the target model can't accept JSON-schema response format and a
non-empty tools array in the same request, the loop injects a synthetic
``final_answer`` tool whose ``parameters`` is the requested output schema.
The model returns its structured answer by calling that tool.

This file covers the three layers of that fallback:
  - capability lookup (which models are whitelisted, mode overrides)
  - request builder (correct request shape on each path)
  - loop body (terminal vs nudge behavior at runtime)
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import patch

import pytest

from opperai.agent import Agent, tool
from opperai.agent._loop import LoopConfig, _build_request
from opperai.agent._models import (
    FINAL_ANSWER_TOOL_NAME,
    supports_structured_outputs_with_tools,
    use_tool_fallback,
)
from opperai.agent._types import RunOptions

# ---------------------------------------------------------------------------
# Capability lookup
# ---------------------------------------------------------------------------


class TestSupportsStructuredOutputsWithTools:
    @pytest.mark.parametrize(
        "model",
        [
            "openai/gpt-4o",
            "openai/gpt-5",
            "azure/openai/gpt-4o-mini",
            "anthropic/claude-sonnet-4-6",
            "anthropic/claude-haiku-4-5",
            "gcp/gemini-2.5-flash",
            "google/gemini-3.0-pro",
            "vertexai/gemini-3.5-flash-eu",
        ],
    )
    def test_known_capable_models(self, model: str) -> None:
        assert supports_structured_outputs_with_tools(model) is True

    @pytest.mark.parametrize(
        "model",
        [
            "mistral/mistral-large",
            "groq/llama-3.1-70b",
            "cohere/command-r-plus",
            "gcp/gemini-1.5-pro",  # 1.x family is not capable
            "evroc/moonshotai/Kimi-K2.6",
            "fireworks/glm-5.1",
        ],
    )
    def test_unknown_or_incapable_models(self, model: str) -> None:
        assert supports_structured_outputs_with_tools(model) is False

    def test_none_model_defaults_to_capable(self) -> None:
        # No model means the gateway picks the default — assume capable.
        assert supports_structured_outputs_with_tools(None) is True

    def test_model_config_dict(self) -> None:
        assert (
            supports_structured_outputs_with_tools(
                {"name": "openai/gpt-4o", "options": {"max_tokens": 100}}
            )
            is True
        )
        assert (
            supports_structured_outputs_with_tools(
                {"name": "mistral/mistral-large"}
            )
            is False
        )

    def test_fallback_chain_uses_first_entry(self) -> None:
        # The gateway tries the first model first; the fallback decision is
        # per-request. Capability lookup follows that lead.
        assert supports_structured_outputs_with_tools(
            ["openai/gpt-4o", "mistral/mistral-large"]
        ) is True
        assert supports_structured_outputs_with_tools(
            ["mistral/mistral-large", "openai/gpt-4o"]
        ) is False


class TestUseToolFallback:
    def test_only_active_when_both_tools_and_schema(self) -> None:
        # Tools alone → no fallback
        assert use_tool_fallback(
            model="mistral/x", has_tools=True, has_output_schema=False, mode=None
        ) is False
        # Schema alone → no fallback (regular structured output works)
        assert use_tool_fallback(
            model="mistral/x", has_tools=False, has_output_schema=True, mode=None
        ) is False

    def test_uses_capability_lookup_in_auto_mode(self) -> None:
        assert use_tool_fallback(
            model="mistral/x", has_tools=True, has_output_schema=True, mode="auto"
        ) is True
        assert use_tool_fallback(
            model="openai/gpt-4o", has_tools=True, has_output_schema=True, mode="auto"
        ) is False

    def test_native_mode_disables_fallback(self) -> None:
        # Force native even when model is unknown (caller knows better).
        assert use_tool_fallback(
            model="mistral/x", has_tools=True, has_output_schema=True, mode="native"
        ) is False

    def test_tool_mode_forces_fallback(self) -> None:
        # Force fallback even on a capable model (debugging / known-broken).
        assert use_tool_fallback(
            model="openai/gpt-4o", has_tools=True, has_output_schema=True, mode="tool"
        ) is True


# ---------------------------------------------------------------------------
# Request builder
# ---------------------------------------------------------------------------


def _config(**overrides: Any) -> LoopConfig:
    base = {
        "name": "test",
        "trace_name": "test",
        "instructions": "you are helpful",
        "tools": [],
        "output_schema": {"type": "object", "properties": {"answer": {"type": "string"}}},
    }
    base.update(overrides)
    return LoopConfig(**base)


class TestBuildRequestFallback:
    def test_native_path_uses_text_format_and_excludes_final_answer(self) -> None:
        config = _config(model="openai/gpt-4o")
        or_tools = [{"type": "function", "name": "search", "parameters": {}}]

        req = _build_request(config, items=[], or_tools=or_tools)

        assert "text" in req and req["text"]["format"]["type"] == "json_schema"
        # No synthetic tool injected on the native path.
        names = [t.get("name") for t in req.get("tools", [])]
        assert FINAL_ANSWER_TOOL_NAME not in names
        assert "search" in names

    def test_fallback_path_drops_text_format_and_adds_final_answer(self) -> None:
        config = _config(model="mistral/large")
        or_tools = [{"type": "function", "name": "search", "parameters": {}}]

        req = _build_request(config, items=[], or_tools=or_tools)

        # Native response_format must be absent — the provider would reject it.
        assert "text" not in req
        # Synthetic tool present, alongside the real tool.
        names = [t.get("name") for t in req["tools"]]
        assert FINAL_ANSWER_TOOL_NAME in names
        assert "search" in names

        # final_answer parameters == the user-requested output schema.
        synth = next(t for t in req["tools"] if t["name"] == FINAL_ANSWER_TOOL_NAME)
        assert synth["parameters"] == config.output_schema

        # Instructions include the fallback contract.
        assert FINAL_ANSWER_TOOL_NAME in req["instructions"]

    def test_no_tools_means_no_fallback_even_on_incapable_model(self) -> None:
        # Without tools, structured output works natively on every provider.
        config = _config(model="mistral/large")
        req = _build_request(config, items=[], or_tools=[])

        assert "text" in req
        assert "tools" not in req

    def test_mode_native_overrides_lookup(self) -> None:
        config = _config(model="mistral/large")
        or_tools = [{"type": "function", "name": "search", "parameters": {}}]
        options = RunOptions(structured_output_mode="native")

        req = _build_request(config, items=[], or_tools=or_tools, options=options)

        assert "text" in req
        names = [t.get("name") for t in req["tools"]]
        assert FINAL_ANSWER_TOOL_NAME not in names

    def test_mode_tool_forces_fallback_even_on_capable_model(self) -> None:
        config = _config(model="openai/gpt-4o")
        or_tools = [{"type": "function", "name": "search", "parameters": {}}]
        options = RunOptions(structured_output_mode="tool")

        req = _build_request(config, items=[], or_tools=or_tools, options=options)

        assert "text" not in req
        names = [t.get("name") for t in req["tools"]]
        assert FINAL_ANSWER_TOOL_NAME in names


# ---------------------------------------------------------------------------
# Loop integration: fake stream that drives the loop end-to-end
# ---------------------------------------------------------------------------


class _StubStream:
    """An async iterator over a fixed list of SSE-shaped event dicts.

    Mirrors the shape that ``_consume_stream`` reads. Successive calls to
    ``factory`` (the side_effect on ``create_stream_async``) produce a fresh
    iterator over the next batch of events, so each iteration of the agent
    loop reads a different scripted response.
    """

    def __init__(self, events: list[dict[str, Any]]) -> None:
        self._events = events

    async def __aiter__(self) -> AsyncIterator[dict[str, Any]]:
        for ev in self._events:
            yield ev


def _scripted_streams(*batches: list[dict[str, Any]]) -> Any:
    """Build a side_effect for create_stream_async that returns each batch in order."""
    queued = list(batches)

    async def factory(*_a: Any, **_kw: Any) -> AsyncIterator[dict[str, Any]]:
        if not queued:
            raise AssertionError("create_stream_async called more times than scripted")
        return _StubStream(queued.pop(0)).__aiter__()

    return factory


def _function_call_events(
    *, call_id: str, name: str, arguments: str, output_index: int = 0
) -> list[dict[str, Any]]:
    """SSE event sequence for a single tool call."""
    return [
        {
            "type": "response.output_item.added",
            "output_index": output_index,
            "item": {"type": "function_call", "call_id": call_id, "name": name},
        },
        {
            "type": "response.function_call_arguments.done",
            "output_index": output_index,
            "arguments": arguments,
        },
    ]


def _text_events(text: str) -> list[dict[str, Any]]:
    return [{"type": "response.output_text.delta", "delta": text}]


def _completed(*, response_id: str = "resp_1", text: str | None = None) -> dict[str, Any]:
    output: list[dict[str, Any]] = []
    if text is not None:
        output.append({
            "type": "message",
            "role": "assistant",
            "content": [{"type": "output_text", "text": text}],
        })
    return {
        "type": "response.completed",
        "response": {
            "id": response_id,
            "output": output,
            "usage": {"input_tokens": 1, "output_tokens": 1, "total_tokens": 2},
        },
    }


@tool
def _noop(value: str) -> str:
    """A no-op tool, just to give the loop a non-empty `tools` array."""
    return value


@pytest.mark.asyncio
async def test_loop_terminates_when_final_answer_is_called() -> None:
    """When the fallback is active and the model calls final_answer, the
    loop must parse its arguments as the structured output, surface the
    delivery as a tool-call record + stream events, and terminate in a
    single iteration."""
    captured_hooks: list[tuple[str, dict[str, Any]]] = []

    from opperai.agent._types import Hooks

    async def on_start(ctx: dict[str, Any]) -> None:
        captured_hooks.append(("start", ctx))

    async def on_end(ctx: dict[str, Any]) -> None:
        captured_hooks.append(("end", ctx))

    agent = Agent(
        name="fb-agent",
        instructions="answer concisely",
        tools=[_noop],
        model="mistral/mistral-large",  # not in capability whitelist
        output_schema={
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
        },
        hooks=Hooks(on_tool_start=on_start, on_tool_end=on_end),
        tracing=False,
        client={"api_key": "test", "base_url": "http://test"},
    )

    events = _function_call_events(
        call_id="fc_1",
        name=FINAL_ANSWER_TOOL_NAME,
        arguments='{"answer": "42"}',
    ) + [_completed()]

    # Collect stream events so we can assert ToolStartEvent / ToolEndEvent
    # are emitted for the synthetic final_answer call.
    stream_events: list[Any] = []
    with patch.object(
        agent._or_client,
        "create_stream_async",
        side_effect=_scripted_streams(events),
    ):
        async for ev in agent.stream("what is the meaning of life?"):
            stream_events.append(ev)
        # Resolve final result from the ResultEvent emitted by stream
        result_event = next(ev for ev in stream_events if type(ev).__name__ == "ResultEvent")
        result_output = result_event.output

    assert result_output == {"answer": "42"}

    # final_answer surfaces as a regular tool call in meta.tool_calls
    fa_records = [c for c in result_event.meta.tool_calls if c.name == FINAL_ANSWER_TOOL_NAME]
    assert len(fa_records) == 1, "final_answer should appear in meta.tool_calls"
    assert fa_records[0].call_id == "fc_1"
    assert fa_records[0].output == {"answer": "42"}

    # Stream events include ToolStartEvent + ToolEndEvent for final_answer.
    fa_starts = [
        ev for ev in stream_events
        if type(ev).__name__ == "ToolStartEvent" and ev.name == FINAL_ANSWER_TOOL_NAME
    ]
    fa_ends = [
        ev for ev in stream_events
        if type(ev).__name__ == "ToolEndEvent" and ev.name == FINAL_ANSWER_TOOL_NAME
    ]
    assert len(fa_starts) == 1 and len(fa_ends) == 1

    # Hooks fire for the synthetic call so user observability sees it.
    fa_hook_events = [name for name, ctx in captured_hooks if ctx.get("name") == FINAL_ANSWER_TOOL_NAME]
    assert "start" in fa_hook_events and "end" in fa_hook_events


@pytest.mark.asyncio
async def test_loop_nudges_when_model_emits_prose_then_calls_final_answer() -> None:
    """If the model produces plain text on iteration 1, the loop must
    inject a nudge and continue rather than returning unstructured text."""
    agent = Agent(
        name="fb-agent",
        instructions="answer concisely",
        tools=[_noop],
        model="mistral/mistral-large",
        output_schema={
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
        },
        max_iterations=3,
        tracing=False,
        client={"api_key": "test", "base_url": "http://test"},
    )

    # Iteration 1: model produces text, no tool call.
    iter1 = _text_events("I think it's 42") + [
        _completed(response_id="resp_1", text="I think it's 42"),
    ]
    # Iteration 2: model complies and calls final_answer.
    iter2 = _function_call_events(
        call_id="fc_2",
        name=FINAL_ANSWER_TOOL_NAME,
        arguments='{"answer": "42"}',
    ) + [_completed(response_id="resp_2")]

    captured_requests: list[dict[str, Any]] = []

    factory = _scripted_streams(iter1, iter2)

    async def capturing_factory(req: dict[str, Any], *a: Any, **kw: Any) -> Any:
        captured_requests.append(req)
        return await factory(req, *a, **kw)

    with patch.object(
        agent._or_client,
        "create_stream_async",
        side_effect=capturing_factory,
    ):
        result = await agent.run("what is the meaning of life?")

    assert result.output == {"answer": "42"}
    assert result.meta.iterations == 2

    # Iteration 2's input should contain the nudge system message.
    iter2_input = captured_requests[1]["input"]
    nudge_messages = [
        msg for msg in iter2_input
        if isinstance(msg, dict)
        and msg.get("role") == "system"
        and FINAL_ANSWER_TOOL_NAME in str(msg.get("content", ""))
    ]
    assert len(nudge_messages) >= 1


@pytest.mark.asyncio
async def test_final_answer_span_callback_is_invoked() -> None:
    """The agent installs ``record_final_answer`` on the loop config when
    tracing is on. The loop must call it with (call_id, args_raw, output)
    so the platform sees a span for the synthetic final answer."""
    recorded: list[tuple[str, str, Any]] = []

    agent = Agent(
        name="fb-agent",
        instructions="answer concisely",
        tools=[_noop],
        model="mistral/mistral-large",
        output_schema={
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
        },
        tracing=False,  # disable real tracing, then inject our own callback
        client={"api_key": "test", "base_url": "http://test"},
    )

    # Simulate the agent layer installing a span recorder. We bypass the
    # real spans_client by patching ``_build_loop_config`` to attach our
    # capture callback. Same shape as the real recorder.
    original_build = agent._build_loop_config

    async def fake_recorder(call_id: str, args_raw: str, output: Any) -> None:
        recorded.append((call_id, args_raw, output))

    def patched_build(resolved_tools: list[Any]) -> Any:
        cfg = original_build(resolved_tools)
        cfg.record_final_answer = fake_recorder
        return cfg

    events = _function_call_events(
        call_id="fc_1",
        name=FINAL_ANSWER_TOOL_NAME,
        arguments='{"answer": "42"}',
    ) + [_completed()]

    with patch.object(agent, "_build_loop_config", side_effect=patched_build):
        with patch.object(
            agent._or_client,
            "create_stream_async",
            side_effect=_scripted_streams(events),
        ):
            result = await agent.run("question")

    assert result.output == {"answer": "42"}
    assert recorded == [("fc_1", '{"answer": "42"}', {"answer": "42"})]


@pytest.mark.asyncio
async def test_native_path_unchanged_for_capable_models() -> None:
    """A model on the whitelist must still receive the JSON-schema
    response format — no synthetic tool, no fallback contract injected."""
    agent = Agent(
        name="native-agent",
        instructions="answer concisely",
        tools=[_noop],
        model="openai/gpt-4o",
        output_schema={
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
        },
        tracing=False,
        client={"api_key": "test", "base_url": "http://test"},
    )

    captured: list[dict[str, Any]] = []

    # Single iteration: model returns text matching the schema (the native
    # path returns the structured answer in the assistant message text).
    events = [_completed(response_id="resp_1", text='{"answer": "42"}')]

    async def capturing(req: dict[str, Any], *a: Any, **kw: Any) -> Any:
        captured.append(req)
        return _StubStream(events).__aiter__()

    with patch.object(
        agent._or_client,
        "create_stream_async",
        side_effect=capturing,
    ):
        result = await agent.run("question")

    assert result.output == {"answer": "42"}
    # Native shape: text.format present, no synthetic tool.
    req = captured[0]
    assert "text" in req and req["text"]["format"]["type"] == "json_schema"
    names = [t.get("name") for t in req.get("tools", [])]
    assert FINAL_ANSWER_TOOL_NAME not in names
    # Native path doesn't prepend the fallback instructions.
    assert FINAL_ANSWER_TOOL_NAME not in req["instructions"]
