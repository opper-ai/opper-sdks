"""Agent SDK — Tracing (Opper Observability).

Wraps each AgentTool's ``execute`` so the call runs inside its own span
context. Sub-agent LLM calls nest under the tool span via the
``is_tool_span`` marker on ``TraceContext``.

Span *creates* are awaited inline (we need the resulting span id).
Span *updates* are deferred via a per-Agent pending-update list and
flushed at the end of the run — keeping span PATCH latency off the
agent's hot path while still guaranteeing the updates land before the
caller sees the result.
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any

from .._context import TraceContext, get_trace_context, set_trace_context
from ..clients.spans import SpansClient
from ._serialize import to_json_str, to_text
from ._types import AgentTool

# Type alias: schedule a span update to run later. Never raises.
DeferUpdate = Callable[..., None]


def wrap_tool_with_tracing(
    tool: AgentTool,
    spans_client: SpansClient,
    defer_update: DeferUpdate,
) -> AgentTool:
    """Wrap a tool's ``execute`` to create a span and set trace context during execution.

    Mirrors the TypeScript ``wrapToolWithTracing``:
      * Span ``type`` is ``"SubAgent"`` for sub-agent tools (see ``Agent.as_tool``),
        ``"tool"`` otherwise.
      * Span ``tags`` include ``{"tool": True}`` (plus ``"subagent": True`` for sub-agents).
      * While ``execute`` runs, the ambient ``TraceContext`` points at the tool span
        and sets ``is_tool_span=True`` so nested agent runs can skip a redundant
        root span.
      * Span PATCH (end_time / output / error) is deferred via ``defer_update`` so
        it doesn't sit on the hot path; the Agent flushes the queue at end of run.
      * If no ambient trace context is active, or span creation fails, the tool
        runs without tracing — tracing must never break execution.
    """
    original_execute = tool.execute
    span_meta: dict[str, Any] = (
        {"type": "SubAgent", "tags": {"tool": True, "subagent": True}}
        if tool._sub_agent
        else {"type": "tool", "tags": {"tool": True}}
    )

    async def traced_execute(*args: Any, **kwargs: Any) -> Any:
        trace_ctx = get_trace_context()
        if trace_ctx is None:
            return await _call_execute(original_execute, args, kwargs)

        try:
            span = await spans_client.create_async(
                name=tool.name,
                start_time=datetime.now(timezone.utc).isoformat(),
                input=_input_repr(args, kwargs),
                trace_id=trace_ctx.trace_id,
                parent_id=trace_ctx.span_id,
                type=span_meta["type"],
                tags=span_meta["tags"],
            )
        except BaseException:
            # Span creation failed — run without tracing
            return await _call_execute(original_execute, args, kwargs)

        previous_ctx = trace_ctx
        set_trace_context(
            TraceContext(span_id=span.id, trace_id=span.trace_id, is_tool_span=True)
        )
        try:
            result = await _call_execute(original_execute, args, kwargs)
        except BaseException as err:
            defer_update(
                span.id,
                end_time=datetime.now(timezone.utc).isoformat(),
                error=str(err),
            )
            raise
        finally:
            set_trace_context(previous_ctx)

        defer_update(
            span.id,
            end_time=datetime.now(timezone.utc).isoformat(),
            output=to_text(result),
        )
        return result

    return replace(tool, execute=traced_execute)


async def _call_execute(execute: Any, args: tuple[Any, ...], kwargs: dict[str, Any]) -> Any:
    """Invoke the tool's execute, awaiting the result if it's a coroutine."""
    result = execute(*args, **kwargs)
    if inspect.iscoroutine(result):
        result = await result
    return result


def _input_repr(args: tuple[Any, ...], kwargs: dict[str, Any]) -> str:
    """Serialize tool invocation arguments for span input."""
    if args and not kwargs and len(args) == 1:
        return to_json_str(args[0])
    if not args and kwargs:
        return to_json_str(kwargs)
    return to_json_str({"args": list(args), "kwargs": kwargs})


def schedule_span_update(
    pending: list[asyncio.Task[None]],
    spans_client: SpansClient,
    span_id: str,
    **payload: Any,
) -> None:
    """Queue a span update to run in the background; flushed at end of run.

    The actual PATCH happens off the hot path. Any failure is swallowed —
    tracing must never break execution. If there's no running event loop,
    the coroutine is closed silently.
    """

    async def _update() -> None:
        try:
            await spans_client.update_async(span_id, **payload)
        except BaseException:
            pass

    coro = _update()
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        coro.close()
        return

    task = loop.create_task(coro)
    pending.append(task)


async def flush_pending_span_updates(pending: list[asyncio.Task[None]]) -> None:
    """Await all queued span updates; never raises."""
    if not pending:
        return
    tasks = list(pending)
    pending.clear()
    await asyncio.gather(*tasks, return_exceptions=True)
