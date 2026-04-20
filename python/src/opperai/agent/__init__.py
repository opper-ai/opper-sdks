"""Opper Agent SDK — build agents with tools, streaming, and multi-agent composition."""

from __future__ import annotations

import inspect
import os
from collections.abc import AsyncGenerator, Callable
from datetime import datetime, timezone
from typing import Any, Literal, overload

from .._base_client import BaseClient
from .._context import TraceContext, get_trace_context, set_trace_context
from .._schema import parse_output, resolve_schema
from ..clients.openresponses import OpenResponsesClient
from ..clients.spans import SpansClient
from ..types import Model
from ._conversation import Conversation
from ._errors import AbortError, AgentError, MaxIterationsError
from ._hooks import merge_hooks
from ._loop import LoopConfig, stream_loop
from ._serialize import to_json_str, to_text
from ._stream import AgentStream
from ._tracing import create_tool_tracing_hooks
from ._types import (
    AgentStreamEvent,
    AgentTool,
    AggregatedUsage,
    Hooks,
    IterationEndEvent,
    IterationStartEvent,
    ReasoningDeltaEvent,
    ResultEvent,
    RetryPolicy,
    RunMeta,
    RunOptions,
    RunResult,
    StreamErrorEvent,
    TextDeltaEvent,
    ToolCallRecord,
    ToolEndEvent,
    ToolProvider,
    ToolStartEvent,
    is_tool_provider,
)

__all__ = [
    # Core
    "Agent",
    "AgentStream",
    "Conversation",
    "tool",
    # Types
    "AgentTool",
    "Hooks",
    "RetryPolicy",
    "RunResult",
    "RunMeta",
    "RunOptions",
    "AggregatedUsage",
    "ToolCallRecord",
    "ToolProvider",
    # Stream events
    "AgentStreamEvent",
    "IterationStartEvent",
    "TextDeltaEvent",
    "ReasoningDeltaEvent",
    "ToolStartEvent",
    "ToolEndEvent",
    "IterationEndEvent",
    "ResultEvent",
    "StreamErrorEvent",
    # Errors
    "AgentError",
    "MaxIterationsError",
    "AbortError",
    # Hooks
    "merge_hooks",
]


# =============================================================================
# @tool decorator
# =============================================================================


@overload
def tool(fn: Callable[..., Any], /) -> AgentTool: ...


@overload
def tool(
    *,
    name: str | None = None,
    description: str | None = None,
    parameters: dict[str, Any] | None = None,
) -> Callable[[Callable[..., Any]], AgentTool]: ...


def tool(
    fn: Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    description: str | None = None,
    parameters: dict[str, Any] | None = None,
) -> AgentTool | Callable[[Callable[..., Any]], AgentTool]:
    """Decorate a function to make it an AgentTool.

    Usage::

        @tool
        def get_weather(city: str) -> str:
            '''Get the current weather for a city.'''
            return f"Sunny in {city}"

        @tool(name="weather", description="Get weather")
        def get_weather(city: str) -> str:
            return f"Sunny in {city}"
    """

    def decorator(f: Callable[..., Any]) -> AgentTool:
        tool_name = name or f.__name__
        tool_desc = description or (inspect.getdoc(f) or "").strip()
        tool_params = parameters or _params_from_annotations(f)

        return AgentTool(
            name=tool_name,
            description=tool_desc,
            parameters=tool_params,
            execute=f,
        )

    if fn is not None:
        return decorator(fn)
    return decorator


def _params_from_annotations(fn: Callable[..., Any]) -> dict[str, Any] | None:
    """Extract JSON Schema from function type annotations."""
    try:
        hints = _get_type_hints_safe(fn)
    except Exception:
        return None

    hints.pop("return", None)
    if not hints:
        return None

    sig = inspect.signature(fn)
    properties: dict[str, Any] = {}
    required: list[str] = []

    for param_name, param_type in hints.items():
        param = sig.parameters.get(param_name)
        prop = _python_type_to_json_schema(param_type)

        # Add description from parameter annotation if available
        properties[param_name] = prop

        # Required if no default value and not Optional
        has_default = param is not None and param.default is not inspect.Parameter.empty
        is_optional = _is_optional_type(param_type)
        if not has_default and not is_optional:
            required.append(param_name)

    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def _get_type_hints_safe(fn: Callable[..., Any]) -> dict[str, Any]:
    """Get type hints, handling common edge cases."""
    import typing

    try:
        return typing.get_type_hints(fn)
    except Exception:
        # Fallback to annotations dict
        return getattr(fn, "__annotations__", {})


_PYTHON_TYPE_TO_JSON: dict[type, str] = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
}


def _python_type_to_json_schema(tp: Any) -> dict[str, Any]:
    """Convert a Python type annotation to a JSON Schema fragment."""
    if tp in _PYTHON_TYPE_TO_JSON:
        return {"type": _PYTHON_TYPE_TO_JSON[tp]}

    origin = getattr(tp, "__origin__", None)

    # list[X]
    if origin is list:
        args = getattr(tp, "__args__", ())
        items = _python_type_to_json_schema(args[0]) if args else {}
        return {"type": "array", "items": items}

    # dict[str, X]
    if origin is dict:
        return {"type": "object"}

    # Optional[X] / X | None
    if origin is type(int | str):
        args = [a for a in tp.__args__ if a is not type(None)]
        if len(args) == 1:
            return _python_type_to_json_schema(args[0])

    # Pydantic BaseModel
    if isinstance(tp, type) and hasattr(tp, "model_json_schema"):
        return tp.model_json_schema()

    return {}


def _is_optional_type(tp: Any) -> bool:
    """Check if a type is Optional (X | None)."""
    origin = getattr(tp, "__origin__", None)
    if origin is type(int | str):
        return type(None) in tp.__args__
    return False


# =============================================================================
# Agent class
# =============================================================================


class Agent:
    """An Opper agent that runs an agentic loop with tools.

    Example::

        from opperai.agent import Agent, tool

        @tool
        def get_weather(city: str) -> str:
            '''Get weather for a city.'''
            return f"Sunny in {city}"

        agent = Agent(
            name="weather-bot",
            instructions="You help with weather questions.",
            tools=[get_weather],
        )

        result = agent.run("What's the weather in Paris?")
        print(result.output)
    """

    def __init__(
        self,
        *,
        name: str,
        instructions: str,
        tools: list[AgentTool | ToolProvider] | None = None,
        model: Model | None = None,
        output_schema: Any = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        max_iterations: int = 25,
        reasoning_effort: Literal["low", "medium", "high"] | None = None,
        parallel_tool_execution: bool = True,
        hooks: Hooks | None = None,
        trace_name: str | None = None,
        tracing: bool = True,
        client: dict[str, str] | None = None,
        retry: RetryPolicy | None = None,
        on_max_iterations: Literal["throw", "return_partial"] = "throw",
    ) -> None:
        """Initialise an Agent.

        ``model`` accepts a string, a ``ModelConfig`` dict with provider-specific
        options, or a list of either as a fallback chain (e.g.
        ``["anthropic/claude-haiku-4-5", "gcp/gemini-2.5-flash"]``).
        """
        self.name: str = name
        self.instructions: str = instructions
        self._raw_tools: list[AgentTool | ToolProvider] = tools or []
        self.model: Model | None = model
        self._output_schema_input: Any = output_schema
        self._output_schema_json: dict[str, Any] | None = None
        self.temperature: float | None = temperature
        self.max_tokens: int | None = max_tokens
        self.max_iterations: int = max_iterations
        self.reasoning_effort: Literal["low", "medium", "high"] | None = reasoning_effort
        self.parallel_tool_execution: bool = parallel_tool_execution
        self.hooks: Hooks | None = hooks
        self.trace_name: str = trace_name or name
        self.tracing: bool = tracing
        self.retry: RetryPolicy | None = retry
        self.on_max_iterations: Literal["throw", "return_partial"] = on_max_iterations

        # Resolve client
        client_config = client or {}
        api_key = client_config.get("api_key") or os.environ.get("OPPER_API_KEY", "")
        base_url = client_config.get("base_url") or os.environ.get(
            "OPPER_BASE_URL", "https://api.opper.ai"
        )
        base_client = BaseClient(api_key=api_key, base_url=base_url)
        self._or_client = OpenResponsesClient(base_client)

        # Tracing: create tool-level spans when tracing is enabled and an API key is present
        self._spans_client: SpansClient | None = None
        if tracing and api_key:
            self._spans_client = SpansClient(base_client)
            tracing_hooks = create_tool_tracing_hooks(self._spans_client)
            self.hooks = merge_hooks(hooks, tracing_hooks)

        # Resolve output schema
        if output_schema is not None:
            self._output_schema_json = resolve_schema(output_schema)

    @property
    def tools(self) -> list[AgentTool]:
        """Return the list of plain AgentTool objects (excludes ToolProviders)."""
        return [t for t in self._raw_tools if isinstance(t, AgentTool)]

    # --- run ------------------------------------------------------------------

    async def run(self, input: str | list[Any], **kwargs: Any) -> RunResult:
        """Run the agent to completion. Drains the stream internally.

        Example::

            result = await agent.run("What's the weather in Paris?")
            print(result.output)
        """
        options = _kwargs_to_run_options(kwargs) if kwargs else None

        if not self.tracing or not self._spans_client:
            return await self._execute_run(input, options)

        ambient = get_trace_context()
        parent_id, trace_id = _resolve_parent_ids(options, ambient)

        try:
            span = await self._spans_client.create_async(
                name=self.trace_name,
                start_time=datetime.now(timezone.utc).isoformat(),
                input=to_text(input),
                trace_id=trace_id,
                parent_id=parent_id,
            )
        except BaseException:
            # Tracing must never break the agent — run without tracing
            return await self._execute_run(input, options)

        trace_context = TraceContext(span_id=span.id, trace_id=span.trace_id)
        set_trace_context(trace_context)

        try:
            result = await self._execute_run(input, options)

            try:
                await self._spans_client.update_async(
                    span.id,
                    end_time=datetime.now(timezone.utc).isoformat(),
                    output=to_text(result.output),
                )
            except BaseException:
                pass

            return result
        except BaseException as err:
            try:
                await self._spans_client.update_async(
                    span.id,
                    end_time=datetime.now(timezone.utc).isoformat(),
                    error=str(err),
                )
            except BaseException:
                pass
            raise
        finally:
            # Restore previous trace context
            set_trace_context(ambient)

    async def _execute_run(
        self, input: str | list[Any], options: RunOptions | None
    ) -> RunResult:
        """Internal: execute the run loop (no tracing wrapper)."""
        resolved_tools, providers = await self._resolve_tools()

        try:
            config = self._build_loop_config(resolved_tools)
            result: RunResult | None = None

            async for event in stream_loop(self._or_client, config, input, options):
                if isinstance(event, ResultEvent):
                    output = event.output
                    if self._output_schema_input is not None and output is not None:
                        output = parse_output(output, self._output_schema_input)
                    result = RunResult(output=output, meta=event.meta)

            if result is None:
                raise AgentError("Agent loop ended without producing a result")
            return result
        finally:
            for provider in providers:
                try:
                    await provider.teardown()
                except Exception:
                    pass

    # --- stream ---------------------------------------------------------------

    def stream(self, input: str | list[Any], **kwargs: Any) -> AgentStream:
        """Stream agent events as an async iterator.

        Example::

            stream = agent.stream("What's the weather?")
            async for event in stream:
                if event.type == "text_delta":
                    print(event.text, end="", flush=True)
            result = await stream.result()
        """
        return AgentStream(self._make_stream_generator(input, kwargs))

    async def _make_stream_generator(
        self, input: str | list[Any], kwargs: dict[str, Any]
    ) -> Any:
        """Create the underlying async generator for streaming."""
        options = _kwargs_to_run_options(kwargs) if kwargs else None

        if not self.tracing or not self._spans_client:
            async for event in self._execute_stream(input, options):
                yield event
            return

        ambient = get_trace_context()
        parent_id, trace_id = _resolve_parent_ids(options, ambient)

        try:
            span = await self._spans_client.create_async(
                name=self.trace_name,
                start_time=datetime.now(timezone.utc).isoformat(),
                input=to_text(input),
                trace_id=trace_id,
                parent_id=parent_id,
            )
        except BaseException:
            # Tracing must never break the agent — stream without tracing
            async for event in self._execute_stream(input, options):
                yield event
            return

        trace_context = TraceContext(span_id=span.id, trace_id=span.trace_id)
        set_trace_context(trace_context)

        last_result: RunResult | None = None
        try:
            async for event in self._execute_stream(input, options):
                if isinstance(event, ResultEvent):
                    last_result = RunResult(output=event.output, meta=event.meta)
                yield event

            try:
                output = last_result.output if last_result else None
                await self._spans_client.update_async(
                    span.id,
                    end_time=datetime.now(timezone.utc).isoformat(),
                    output=to_text(output),
                )
            except BaseException:
                pass
        except BaseException as err:
            try:
                await self._spans_client.update_async(
                    span.id,
                    end_time=datetime.now(timezone.utc).isoformat(),
                    error=str(err),
                )
            except BaseException:
                pass
            raise
        finally:
            set_trace_context(ambient)

    async def _execute_stream(  # type: ignore[return]
        self, input: str | list[Any], options: RunOptions | None
    ) -> AsyncGenerator[AgentStreamEvent, None]:
        """Internal: execute the stream loop (no tracing wrapper)."""
        resolved_tools, providers = await self._resolve_tools()

        try:
            config = self._build_loop_config(resolved_tools)
            async for event in stream_loop(self._or_client, config, input, options):
                if isinstance(event, ResultEvent) and self._output_schema_input is not None:
                    output = event.output
                    if output is not None:
                        output = parse_output(output, self._output_schema_input)
                    yield ResultEvent(output=output, meta=event.meta)
                else:
                    yield event
        finally:
            for provider in providers:
                try:
                    await provider.teardown()
                except Exception:
                    pass

    # --- as_tool --------------------------------------------------------------
    # (Stub — full implementation in Phase 5)

    def as_tool(self, *, name: str, description: str) -> AgentTool:
        """Wrap this agent as a tool for another agent."""
        parent = self

        async def execute(input: str = "", **_: Any) -> dict[str, Any]:
            # ``_execute_tool`` unpacks dict tool arguments as keyword args
            # (``tool.execute(**parsed)``), so we accept ``input=`` directly
            # and ignore any extra keys the model happens to hallucinate.
            input_text = input if isinstance(input, str) else str(input)
            result = await parent.run(input_text)
            return {
                "output": to_json_str(result.output),
                "usage": {
                    "input_tokens": result.meta.usage.input_tokens,
                    "output_tokens": result.meta.usage.output_tokens,
                    "total_tokens": result.meta.usage.total_tokens,
                },
                "iterations": result.meta.iterations,
                "tool_calls": len(result.meta.tool_calls),
            }

        return AgentTool(
            name=name,
            description=description,
            parameters={
                "type": "object",
                "properties": {
                    "input": {
                        "type": "string",
                        "description": "Input prompt for the sub-agent",
                    }
                },
                "required": ["input"],
            },
            execute=execute,
            _sub_agent=True,
        )

    # --- conversation ---------------------------------------------------------
    # (Stub — full implementation in Phase 5)

    def conversation(self) -> Conversation:
        """Create a multi-turn conversation with this agent."""
        return Conversation(self)

    # --- Internal helpers -----------------------------------------------------

    async def _resolve_tools(self) -> tuple[list[AgentTool], list[Any]]:
        """Resolve tool providers and return (all_tools, providers)."""
        resolved: list[AgentTool] = []
        providers: list[Any] = []

        for t in self._raw_tools:
            if is_tool_provider(t):
                providers.append(t)
                tools = await t.setup()  # type: ignore[union-attr]
                resolved.extend(tools)
            else:
                resolved.append(t)  # type: ignore[arg-type]

        return resolved, providers

    def _build_loop_config(self, resolved_tools: list[AgentTool]) -> LoopConfig:
        """Build the internal LoopConfig from agent settings."""
        # Read trace context from contextvars (set by Opper.trace_async())
        trace_context: dict[str, str] | None = None
        ctx = get_trace_context()
        if ctx is not None:
            trace_context = {"span_id": ctx.span_id, "trace_id": ctx.trace_id}

        return LoopConfig(
            name=self.name,
            trace_name=self.trace_name,
            instructions=self.instructions,
            tools=resolved_tools,
            model=self.model,
            output_schema=self._output_schema_json,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            max_iterations=self.max_iterations,
            reasoning_effort=self.reasoning_effort,
            parallel_tool_execution=self.parallel_tool_execution,
            hooks=self.hooks,
            trace_context=trace_context,
            retry=self.retry,
            on_max_iterations=self.on_max_iterations,
        )


def _kwargs_to_run_options(kwargs: dict[str, Any]) -> RunOptions:
    """Convert keyword arguments to a RunOptions dataclass."""
    return RunOptions(
        model=kwargs.get("model"),
        temperature=kwargs.get("temperature"),
        max_tokens=kwargs.get("max_tokens"),
        max_iterations=kwargs.get("max_iterations"),
        reasoning_effort=kwargs.get("reasoning_effort"),
        parent_span_id=kwargs.get("parent_span_id"),
    )


def _resolve_parent_ids(
    options: RunOptions | None, ambient: TraceContext | None
) -> tuple[str | None, str | None]:
    """Return (parent_id, trace_id) for the agent's parent span.

    An explicit ``parent_span_id`` on the run options fully overrides ambient
    trace context (mirrors ``opper.call`` semantics at ``_client.py`` — an
    explicit parent may belong to a different trace, so mixing its ID with
    ``ambient.trace_id`` would produce a mismatched pair). When no explicit
    value is given we fall back to the ambient span and trace.
    """
    explicit = options.parent_span_id if options else None
    if explicit is not None:
        return explicit, None
    if ambient is not None:
        return ambient.span_id, ambient.trace_id
    return None, None
