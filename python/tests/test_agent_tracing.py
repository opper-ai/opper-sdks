"""Tests for Agent Tracing hooks."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from opperai._context import TraceContext, get_trace_context, set_trace_context
from opperai.agent._tracing import create_tool_tracing_hooks
from opperai.clients.spans import SpansClient


@pytest.fixture(autouse=True)
def _clear_trace_context() -> Any:
    """Ensure trace context is clean before and after each test."""
    set_trace_context(None)
    yield
    set_trace_context(None)


class TestToolTracingHooks:
    @pytest.mark.asyncio
    async def test_no_trace_context_is_noop(self) -> None:
        """When no trace context is active, hooks should be silent no-ops."""
        mock_client = MagicMock(spec=SpansClient)
        hooks = create_tool_tracing_hooks(mock_client)

        assert hooks.on_tool_start is not None
        await hooks.on_tool_start({
            "name": "get_weather",
            "call_id": "fc_0",
            "input": {"city": "Paris"},
        })
        mock_client.create_async.assert_not_called()

    @pytest.mark.asyncio
    async def test_creates_span_on_tool_start(self) -> None:
        """Tool start should create a child span via SpansClient."""
        set_trace_context(TraceContext(span_id="parent-span-123", trace_id="trace-456"))

        mock_client = MagicMock(spec=SpansClient)
        mock_span = MagicMock()
        mock_span.id = "child-span-789"
        mock_client.create_async = AsyncMock(return_value=mock_span)

        hooks = create_tool_tracing_hooks(mock_client)

        assert hooks.on_tool_start is not None
        await hooks.on_tool_start({
            "name": "get_weather",
            "call_id": "fc_0",
            "input": {"city": "Paris"},
        })

        mock_client.create_async.assert_called_once()
        call_kwargs = mock_client.create_async.call_args[1]
        assert call_kwargs["name"] == "get_weather"
        assert call_kwargs["trace_id"] == "trace-456"
        assert call_kwargs["parent_id"] == "parent-span-123"
        assert '"city": "Paris"' in call_kwargs["input"]

    @pytest.mark.asyncio
    async def test_updates_span_on_tool_end(self) -> None:
        """Tool end should update the child span with output."""
        set_trace_context(TraceContext(span_id="parent-span-123", trace_id="trace-456"))

        mock_client = MagicMock(spec=SpansClient)
        mock_span = MagicMock()
        mock_span.id = "child-span-789"
        mock_client.create_async = AsyncMock(return_value=mock_span)
        mock_client.update_async = AsyncMock()

        hooks = create_tool_tracing_hooks(mock_client)

        assert hooks.on_tool_start is not None
        assert hooks.on_tool_end is not None

        await hooks.on_tool_start({
            "name": "get_weather",
            "call_id": "fc_0",
            "input": {"city": "Paris"},
        })

        await hooks.on_tool_end({
            "name": "get_weather",
            "call_id": "fc_0",
            "output": {"temp": 22, "condition": "Sunny"},
            "error": None,
            "duration_ms": 150.0,
        })

        mock_client.update_async.assert_called_once()
        call_args = mock_client.update_async.call_args
        assert call_args[0][0] == "child-span-789"
        assert "end_time" in call_args[1]
        assert '"temp": 22' in call_args[1]["output"]

    @pytest.mark.asyncio
    async def test_updates_span_with_error(self) -> None:
        """Tool end with error should record the error on the span."""
        set_trace_context(TraceContext(span_id="parent-span-123", trace_id="trace-456"))

        mock_client = MagicMock(spec=SpansClient)
        mock_span = MagicMock()
        mock_span.id = "child-span-789"
        mock_client.create_async = AsyncMock(return_value=mock_span)
        mock_client.update_async = AsyncMock()

        hooks = create_tool_tracing_hooks(mock_client)

        assert hooks.on_tool_start is not None
        assert hooks.on_tool_end is not None

        await hooks.on_tool_start({
            "name": "get_weather",
            "call_id": "fc_0",
            "input": {},
        })

        await hooks.on_tool_end({
            "name": "get_weather",
            "call_id": "fc_0",
            "output": None,
            "error": "Connection timeout",
            "duration_ms": 5000.0,
        })

        call_kwargs = mock_client.update_async.call_args[1]
        assert call_kwargs["error"] == "Connection timeout"

    @pytest.mark.asyncio
    async def test_tool_end_without_start_is_noop(self) -> None:
        """Tool end for an unknown call_id should silently skip."""
        set_trace_context(TraceContext(span_id="parent-span-123", trace_id="trace-456"))

        mock_client = MagicMock(spec=SpansClient)
        mock_client.update_async = AsyncMock()

        hooks = create_tool_tracing_hooks(mock_client)

        assert hooks.on_tool_end is not None
        await hooks.on_tool_end({
            "name": "get_weather",
            "call_id": "unknown_id",
            "output": "result",
            "error": None,
            "duration_ms": 100.0,
        })

        mock_client.update_async.assert_not_called()

    @pytest.mark.asyncio
    async def test_tracing_failure_does_not_raise(self) -> None:
        """Tracing errors should be silently swallowed."""
        set_trace_context(TraceContext(span_id="parent-span-123", trace_id="trace-456"))

        mock_client = MagicMock(spec=SpansClient)
        mock_client.create_async = AsyncMock(side_effect=Exception("Network error"))

        hooks = create_tool_tracing_hooks(mock_client)

        assert hooks.on_tool_start is not None
        # Should not raise
        await hooks.on_tool_start({
            "name": "get_weather",
            "call_id": "fc_0",
            "input": {},
        })

    @pytest.mark.asyncio
    async def test_multiple_tool_calls_tracked_independently(self) -> None:
        """Each tool call should have its own span."""
        set_trace_context(TraceContext(span_id="parent", trace_id="trace"))

        mock_client = MagicMock(spec=SpansClient)
        span_counter = {"count": 0}

        async def create_span(**kwargs: Any) -> MagicMock:
            span_counter["count"] += 1
            span = MagicMock()
            span.id = f"span-{span_counter['count']}"
            return span

        mock_client.create_async = AsyncMock(side_effect=create_span)
        mock_client.update_async = AsyncMock()

        hooks = create_tool_tracing_hooks(mock_client)

        assert hooks.on_tool_start is not None
        assert hooks.on_tool_end is not None

        # Start two tools
        await hooks.on_tool_start({"name": "tool_a", "call_id": "fc_0", "input": {}})
        await hooks.on_tool_start({"name": "tool_b", "call_id": "fc_1", "input": {}})

        # End them
        await hooks.on_tool_end({"name": "tool_b", "call_id": "fc_1", "output": "b", "error": None, "duration_ms": 50})
        await hooks.on_tool_end({"name": "tool_a", "call_id": "fc_0", "output": "a", "error": None, "duration_ms": 100})

        assert mock_client.create_async.call_count == 2
        assert mock_client.update_async.call_count == 2

        # Verify correct span IDs were updated
        update_calls = mock_client.update_async.call_args_list
        assert update_calls[0][0][0] == "span-2"  # fc_1 -> span-2
        assert update_calls[1][0][0] == "span-1"  # fc_0 -> span-1


class TestAgentParentSpan:
    """Test that Agent.run() creates a parent span wrapping the entire run."""

    @pytest.mark.asyncio
    async def test_run_creates_parent_span(self) -> None:
        """Agent.run() should create a parent span and update it on completion."""
        from unittest.mock import patch

        from opperai.agent import Agent

        agent = Agent(
            name="test-agent",
            instructions="Be helpful.",
            client={"api_key": "test-key"},
            tracing=True,
        )

        # Mock the spans client
        mock_span = MagicMock()
        mock_span.id = "agent-span-1"
        mock_span.trace_id = "trace-1"
        assert agent._spans_client is not None
        agent._spans_client.create_async = AsyncMock(return_value=mock_span)
        agent._spans_client.update_async = AsyncMock()

        # Mock _execute_run to avoid actual LLM calls
        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        mock_result = RunResult(
            output="Hello!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=100), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("Hi")

        assert result.output == "Hello!"

        # Parent span was created
        agent._spans_client.create_async.assert_called_once()
        create_kwargs = agent._spans_client.create_async.call_args[1]
        assert create_kwargs["name"] == "test-agent"
        assert create_kwargs["input"] == "Hi"

        # Parent span was updated with output
        agent._spans_client.update_async.assert_called_once()
        update_kwargs = agent._spans_client.update_async.call_args
        assert update_kwargs[0][0] == "agent-span-1"
        assert "end_time" in update_kwargs[1]
        assert update_kwargs[1]["output"] == "Hello!"

    @pytest.mark.asyncio
    async def test_run_updates_span_on_error(self) -> None:
        """Agent.run() should record the error on the parent span when it fails."""
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

        # Parent span was updated with error
        update_kwargs = agent._spans_client.update_async.call_args[1]
        assert update_kwargs["error"] == "boom"

    @pytest.mark.asyncio
    async def test_run_skips_span_when_tracing_disabled(self) -> None:
        """Agent.run() should not create spans when tracing=False."""
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
        """When a parent trace context exists, agent span should be a child of it."""
        from unittest.mock import patch

        from opperai.agent import Agent

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

        from opperai.agent._types import AggregatedUsage, RunMeta, RunResult

        mock_result = RunResult(
            output="Hi!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=50), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("Hello")

        create_kwargs = agent._spans_client.create_async.call_args[1]
        assert create_kwargs["trace_id"] == "parent-trace"
        assert create_kwargs["parent_id"] == "parent-span"


    @pytest.mark.asyncio
    async def test_span_update_cancelled_error_swallowed(self) -> None:
        """CancelledError during span update must not crash the agent."""
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
        # Simulate CancelledError from MCP teardown racing with span update
        agent._spans_client.update_async = AsyncMock(side_effect=asyncio.CancelledError())

        mock_result = RunResult(
            output="Done!",
            meta=RunMeta(usage=AggregatedUsage(total_tokens=100), iterations=1),
        )
        with patch.object(agent, "_execute_run", new_callable=AsyncMock, return_value=mock_result):
            result = await agent.run("Hi")

        # Agent should return normally despite CancelledError in tracing
        assert result.output == "Done!"

    @pytest.mark.asyncio
    async def test_span_create_failure_falls_through(self) -> None:
        """If span creation fails, agent should run without tracing."""
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
        # update_async should never be called since span creation failed
        agent._spans_client.update_async.assert_not_called()


class TestOpperAgentFactory:
    def test_opper_agent_creates_agent(self) -> None:
        """Opper.agent() should create an Agent with the client's credentials."""
        from opperai._client import Opper

        opper = Opper(api_key="test-key", base_url="https://test.api.opper.ai")
        agent = opper.agent(name="test", instructions="Be helpful.")

        from opperai.agent import Agent

        assert isinstance(agent, Agent)
        assert agent.name == "test"
        assert agent.instructions == "Be helpful."
