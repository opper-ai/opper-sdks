"""Tests for Agent tracing — tool span wrapping, sub-agent skip, deferred updates."""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from opperai._context import TraceContext, get_trace_context, set_trace_context
from opperai.agent._tracing import (
    flush_pending_span_updates,
    schedule_span_update,
    wrap_tool_with_tracing,
)
from opperai.agent._types import AgentTool
from opperai.clients.spans import SpansClient


@pytest.fixture(autouse=True)
def _clear_trace_context() -> Any:
    """Ensure trace context is clean before and after each test."""
    set_trace_context(None)
    yield
    set_trace_context(None)


def _make_spans_client(span_id: str = "tool-span-1", trace_id: str = "trace-1") -> MagicMock:
    client = MagicMock(spec=SpansClient)
    mock_span = MagicMock()
    mock_span.id = span_id
    mock_span.trace_id = trace_id
    client.create_async = AsyncMock(return_value=mock_span)
    client.update_async = AsyncMock()
    return client


def _bind_defer(pending: list[asyncio.Task[None]], client: SpansClient) -> Any:
    """Build a ``defer_update(span_id, **payload)`` bound to a pending list."""

    def defer(span_id: str, **payload: Any) -> None:
        schedule_span_update(pending, client, span_id, **payload)

    return defer


# ---------------------------------------------------------------------------
# wrap_tool_with_tracing
# ---------------------------------------------------------------------------


class TestWrapToolWithTracing:
    @pytest.mark.asyncio
    async def test_runs_directly_when_no_trace_context(self) -> None:
        """With no ambient trace context, wrapper runs execute without touching spans."""
        client = _make_spans_client()
        pending: list[asyncio.Task[None]] = []
        tool = AgentTool(name="t", description="", execute=lambda x=0: x + 1)

        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))
        result = await wrapped.execute(x=3)

        assert result == 4
        client.create_async.assert_not_called()
        client.update_async.assert_not_called()
        assert pending == []

    @pytest.mark.asyncio
    async def test_creates_tool_span_with_type_and_tags(self) -> None:
        """Regular tool spans use type='tool' + tags={'tool': True}."""
        set_trace_context(TraceContext(span_id="agent-span", trace_id="trace-1"))
        client = _make_spans_client()
        pending: list[asyncio.Task[None]] = []
        tool = AgentTool(name="greet", description="", execute=lambda name: f"hi {name}")

        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))
        result = await wrapped.execute(name="alice")
        await flush_pending_span_updates(pending)

        assert result == "hi alice"
        create_kwargs = client.create_async.call_args.kwargs
        assert create_kwargs["name"] == "greet"
        assert create_kwargs["type"] == "tool"
        assert create_kwargs["tags"] == {"tool": True}
        assert create_kwargs["parent_id"] == "agent-span"
        assert create_kwargs["trace_id"] == "trace-1"

    @pytest.mark.asyncio
    async def test_sub_agent_tool_uses_subagent_type_and_tags(self) -> None:
        """Tools marked ``_sub_agent=True`` get type='SubAgent' + subagent tag."""
        set_trace_context(TraceContext(span_id="agent-span", trace_id="trace-1"))
        client = _make_spans_client()
        pending: list[asyncio.Task[None]] = []
        tool = AgentTool(
            name="delegate",
            description="",
            execute=lambda input: input,
            _sub_agent=True,
        )

        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))
        await wrapped.execute(input="hi")

        create_kwargs = client.create_async.call_args.kwargs
        assert create_kwargs["type"] == "SubAgent"
        assert create_kwargs["tags"] == {"tool": True, "subagent": True}

    @pytest.mark.asyncio
    async def test_sets_is_tool_span_during_execute(self) -> None:
        """While execute runs, ambient context is the tool span with is_tool_span=True."""
        set_trace_context(TraceContext(span_id="agent-span", trace_id="trace-1"))
        client = _make_spans_client(span_id="tool-span-x", trace_id="trace-1")
        pending: list[asyncio.Task[None]] = []

        captured: dict[str, TraceContext | None] = {}

        def inner() -> str:
            captured["ctx"] = get_trace_context()
            return "ok"

        tool = AgentTool(name="t", description="", execute=inner)
        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))
        await wrapped.execute()

        assert captured["ctx"] is not None
        assert captured["ctx"].span_id == "tool-span-x"
        assert captured["ctx"].trace_id == "trace-1"
        assert captured["ctx"].is_tool_span is True

        after = get_trace_context()
        assert after is not None
        assert after.span_id == "agent-span"
        assert after.is_tool_span is False

    @pytest.mark.asyncio
    async def test_defers_update_until_flush(self) -> None:
        """Successful execute queues an update; PATCH only fires after flush."""
        set_trace_context(TraceContext(span_id="agent-span", trace_id="trace-1"))
        client = _make_spans_client(span_id="tool-span-ok")
        pending: list[asyncio.Task[None]] = []

        tool = AgentTool(name="t", description="", execute=lambda: {"result": 42})
        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))
        await wrapped.execute()

        # Update was queued, not yet awaited
        assert len(pending) == 1

        await flush_pending_span_updates(pending)

        client.update_async.assert_called_once()
        args, kwargs = client.update_async.call_args
        assert args[0] == "tool-span-ok"
        assert "end_time" in kwargs
        assert '"result": 42' in kwargs["output"]
        assert pending == []  # flushed list is cleared

    @pytest.mark.asyncio
    async def test_defers_error_update_until_flush(self) -> None:
        """Execute raising still propagates, error update is queued + flushed later."""
        set_trace_context(TraceContext(span_id="agent-span", trace_id="trace-1"))
        client = _make_spans_client(span_id="tool-span-err")
        pending: list[asyncio.Task[None]] = []

        def boom() -> None:
            raise RuntimeError("kaboom")

        tool = AgentTool(name="t", description="", execute=boom)
        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))

        with pytest.raises(RuntimeError, match="kaboom"):
            await wrapped.execute()

        assert len(pending) == 1
        await flush_pending_span_updates(pending)

        client.update_async.assert_called_once()
        args, kwargs = client.update_async.call_args
        assert args[0] == "tool-span-err"
        assert kwargs["error"] == "kaboom"

    @pytest.mark.asyncio
    async def test_falls_through_when_span_creation_fails(self) -> None:
        """If span creation raises, execute still runs and result is returned."""
        set_trace_context(TraceContext(span_id="agent-span", trace_id="trace-1"))
        client = MagicMock(spec=SpansClient)
        client.create_async = AsyncMock(side_effect=ConnectionError("down"))
        client.update_async = AsyncMock()
        pending: list[asyncio.Task[None]] = []

        tool = AgentTool(name="t", description="", execute=lambda: "still works")
        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))
        result = await wrapped.execute()

        assert result == "still works"
        client.update_async.assert_not_called()
        assert pending == []

    @pytest.mark.asyncio
    async def test_supports_coroutine_execute(self) -> None:
        """Async execute functions are awaited."""
        set_trace_context(TraceContext(span_id="agent-span", trace_id="trace-1"))
        client = _make_spans_client()
        pending: list[asyncio.Task[None]] = []

        async def run(v: int) -> int:
            await asyncio.sleep(0)
            return v * 2

        tool = AgentTool(name="t", description="", execute=run)
        wrapped = wrap_tool_with_tracing(tool, client, _bind_defer(pending, client))
        result = await wrapped.execute(v=21)

        assert result == 42


# ---------------------------------------------------------------------------
# schedule_span_update / flush_pending_span_updates
# ---------------------------------------------------------------------------


class TestDeferredSpanUpdates:
    @pytest.mark.asyncio
    async def test_schedule_queues_task_without_running_it(self) -> None:
        """schedule_span_update appends a task; HTTP call only fires on flush."""
        client = _make_spans_client()
        client.update_async = AsyncMock()
        pending: list[asyncio.Task[None]] = []

        schedule_span_update(pending, client, "span-1", end_time="t", output="x")
        # Still queued — update not invoked synchronously
        assert len(pending) == 1
        # Task scheduled but not yet awaited
        client.update_async.assert_not_called() if not pending[0].done() else None

        await flush_pending_span_updates(pending)
        client.update_async.assert_called_once_with("span-1", end_time="t", output="x")
        assert pending == []

    @pytest.mark.asyncio
    async def test_flush_collects_multiple_updates(self) -> None:
        """flush_pending_span_updates awaits every queued task in one go."""
        client = _make_spans_client()
        client.update_async = AsyncMock()
        pending: list[asyncio.Task[None]] = []

        schedule_span_update(pending, client, "s1", output="a")
        schedule_span_update(pending, client, "s2", output="b")
        schedule_span_update(pending, client, "s3", output="c")
        assert len(pending) == 3

        await flush_pending_span_updates(pending)

        assert client.update_async.call_count == 3
        called_ids = sorted(c.args[0] for c in client.update_async.call_args_list)
        assert called_ids == ["s1", "s2", "s3"]
        assert pending == []

    @pytest.mark.asyncio
    async def test_flush_swallows_individual_failures(self) -> None:
        """A failing update doesn't break flush or surface to the caller."""
        client = _make_spans_client()
        client.update_async = AsyncMock(side_effect=ConnectionError("down"))
        pending: list[asyncio.Task[None]] = []

        schedule_span_update(pending, client, "s1")
        schedule_span_update(pending, client, "s2")

        # Must not raise
        await flush_pending_span_updates(pending)
        assert pending == []

    @pytest.mark.asyncio
    async def test_flush_on_empty_queue_is_noop(self) -> None:
        pending: list[asyncio.Task[None]] = []
        await flush_pending_span_updates(pending)
        assert pending == []


# ---------------------------------------------------------------------------
# Agent root span lifecycle
# ---------------------------------------------------------------------------


class TestAgentParentSpan:
    @pytest.mark.asyncio
    async def test_run_creates_parent_span_and_flushes_update(self) -> None:
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=True,
        )

        mock_span = MagicMock()
        mock_span.id = "agent-span-1"
        mock_span.trace_id = "trace-1"
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(return_value=mock_span)
        agent._spans_client.update_async = AsyncMock()

        mock_result = RunResult(
            output="Hello!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=100), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("Hi")

        assert result.output == "Hello!"
        create_kwargs = agent._spans_client.create_async.call_args.kwargs
        assert create_kwargs["name"] == "test-agent"
        assert create_kwargs["input"] == "Hi"

        # By the time run() returns, the deferred update must have flushed.
        agent._spans_client.update_async.assert_called_once()
        update_args = agent._spans_client.update_async.call_args
        assert update_args[0][0] == "agent-span-1"
        assert update_args[1]["output"] == "Hello!"
        assert agent._pending_span_updates == []

    @pytest.mark.asyncio
    async def test_run_skips_parent_span_when_ambient_is_tool_span(self) -> None:
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="sub-agent",
            instructions="Specialist.",
            client={"api_key": "test-key"},
            tracing=True,
        )
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock()
        agent._spans_client.update_async = AsyncMock()

        set_trace_context(
            TraceContext(span_id="tool-span", trace_id="trace-1", is_tool_span=True)
        )

        mock_result = RunResult(
            output="done",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=10), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("task")

        assert result.output == "done"
        agent._spans_client.create_async.assert_not_called()
        agent._spans_client.update_async.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_creates_parent_span_when_explicit_parent_given(self) -> None:
        """Explicit parent_span_id wins even when ambient is a tool span."""
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="sub-agent",
            instructions="Specialist.",
            client={"api_key": "test-key"},
            tracing=True,
        )
        mock_span = MagicMock()
        mock_span.id = "explicit-child"
        mock_span.trace_id = "trace-override"
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(return_value=mock_span)
        agent._spans_client.update_async = AsyncMock()

        set_trace_context(
            TraceContext(span_id="tool-span", trace_id="trace-1", is_tool_span=True)
        )

        mock_result = RunResult(
            output="done",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=10), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            await agent.run("task", parent_span_id="user-chosen-parent")

        agent._spans_client.create_async.assert_called_once()
        create_kwargs = agent._spans_client.create_async.call_args.kwargs
        assert create_kwargs["parent_id"] == "user-chosen-parent"

    @pytest.mark.asyncio
    async def test_run_records_error_on_span_and_flushes(self) -> None:
        from unittest.mock import patch

        from opperai.agent import Agent

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=True,
        )
        mock_span = MagicMock()
        mock_span.id = "agent-span-2"
        mock_span.trace_id = "trace-2"
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(return_value=mock_span)
        agent._spans_client.update_async = AsyncMock()

        with patch.object(agent, "_execute_run", new_callable=AsyncMock, side_effect=RuntimeError("boom")):
            with pytest.raises(RuntimeError, match="boom"):
                await agent.run("Hi")

        agent._spans_client.update_async.assert_called_once()
        update_kwargs = agent._spans_client.update_async.call_args[1]
        assert update_kwargs["error"] == "boom"
        # Even on the error path, the queue is drained
        assert agent._pending_span_updates == []

    @pytest.mark.asyncio
    async def test_run_skips_span_when_tracing_disabled(self) -> None:
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=False,
        )
        assert agent._spans_client is None

        mock_result = RunResult(
            output="Hello!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=100), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("Hi")

        assert result.output == "Hello!"

    @pytest.mark.asyncio
    async def test_run_nests_under_existing_trace_context(self) -> None:
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        set_trace_context(TraceContext(span_id="parent-span", trace_id="parent-trace"))

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=True,
        )
        mock_span = MagicMock()
        mock_span.id = "agent-span-3"
        mock_span.trace_id = "parent-trace"
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(return_value=mock_span)
        agent._spans_client.update_async = AsyncMock()

        mock_result = RunResult(
            output="Hi!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=50), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            await agent.run("Hello")

        create_kwargs = agent._spans_client.create_async.call_args.kwargs
        assert create_kwargs["trace_id"] == "parent-trace"
        assert create_kwargs["parent_id"] == "parent-span"

    @pytest.mark.asyncio
    async def test_span_update_failure_is_swallowed(self) -> None:
        """A failing PATCH must not crash the agent — swallowed by flush."""
        import asyncio
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=True,
        )
        mock_span = MagicMock()
        mock_span.id = "agent-span-cancel"
        mock_span.trace_id = "trace-cancel"
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(return_value=mock_span)
        agent._spans_client.update_async = AsyncMock(side_effect=asyncio.CancelledError())

        mock_result = RunResult(
            output="Done!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=100), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("Hi")
        assert result.output == "Done!"

    @pytest.mark.asyncio
    async def test_span_create_failure_falls_through(self) -> None:
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=True,
        )
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(side_effect=ConnectionError("network down"))
        agent._spans_client.update_async = AsyncMock()

        mock_result = RunResult(
            output="Still works!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=50), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("Hi")
        assert result.output == "Still works!"
        agent._spans_client.update_async.assert_not_called()


# ---------------------------------------------------------------------------
# Opper.agent() factory + tool wrapping at construction
# ---------------------------------------------------------------------------


class TestOpperAgentFactory:
    def test_opper_agent_creates_agent(self) -> None:
        from opperai._client import Opper
        from opperai.agent import Agent

        opper = Opper(api_key="test-key", base_url="https://test.api.opper.ai")
        agent = opper.agent(name="test", instructions="Be helpful.")

        assert isinstance(agent, Agent)
        assert agent.name == "test"
        assert agent.instructions == "Be helpful."


class TestAgentWrapsToolsOnInit:
    def test_static_tools_are_wrapped_when_tracing_enabled(self) -> None:
        from opperai.agent import Agent

        original = AgentTool(name="t", description="", execute=lambda: None)
        agent = Agent(
            name="a",
            instructions="",
            tools=[original],
            client={"api_key": "test-key"},
            tracing=True,
        )

        stored = agent.tools[0]
        assert stored.name == "t"
        assert stored.execute is not original.execute

    def test_static_tools_are_not_wrapped_when_tracing_disabled(self) -> None:
        from opperai.agent import Agent

        original = AgentTool(name="t", description="", execute=lambda: None)
        agent = Agent(
            name="a",
            instructions="",
            tools=[original],
            client={"api_key": "test-key"},
            tracing=False,
        )

        stored = agent.tools[0]
        assert stored.execute is original.execute


# ---------------------------------------------------------------------------
# End-to-end deferred queue behavior on the Agent
# ---------------------------------------------------------------------------


class TestAgentDeferredFlushE2E:
    """Verify per-Agent _pending_span_updates is drained exactly once per run."""

    @pytest.mark.asyncio
    async def test_tool_span_update_flushed_before_run_returns(self) -> None:
        """Tool span PATCH lands by the time agent.run() returns."""
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            tools=[AgentTool(name="t", description="", execute=lambda: "ok")],
            client={"api_key": "test-key"},
            tracing=True,
        )

        # Mock the spans client with separate IDs for agent root vs tool span
        span_counter = {"n": 0}

        async def create_side_effect(**_: Any) -> MagicMock:
            span_counter["n"] += 1
            s = MagicMock()
            s.id = f"span-{span_counter['n']}"
            s.trace_id = "trace-1"
            return s

        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(side_effect=create_side_effect)
        agent._spans_client.update_async = AsyncMock()

        # Drive a run that triggers the wrapped tool execute
        async def fake_execute_run(input: Any, options: Any) -> RunResult:
            tool = agent.tools[0]
            await tool.execute()  # invokes the wrapped execute, queues a span update
            return RunResult(
                output="done",
                meta=RunMeta(usage=AggregatedUsage(total_tokens=5), iterations=1),
            )

        with patch.object(agent, "_execute_run", side_effect=fake_execute_run):
            result = await agent.run("go")

        assert result.output == "done"
        # Both the tool span PATCH and the agent root span PATCH should have fired
        assert agent._spans_client.update_async.call_count == 2
        # Queue is empty after the run
        assert agent._pending_span_updates == []

    @pytest.mark.asyncio
    async def test_pending_queue_empty_after_run_with_failing_update(self) -> None:
        """Even if the deferred PATCH fails, the queue is cleared."""
        from unittest.mock import patch

        from opperai.agent import Agent
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=True,
        )

        mock_span = MagicMock()
        mock_span.id = "agent-span"
        mock_span.trace_id = "trace-1"
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(return_value=mock_span)
        agent._spans_client.update_async = AsyncMock(side_effect=ConnectionError("down"))

        mock_result = RunResult(
            output="ok",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=1), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("hi")

        assert result.output == "ok"
        assert agent._pending_span_updates == []
