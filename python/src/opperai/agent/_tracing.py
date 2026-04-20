"""Agent SDK — Tracing (Opper Observability).

Creates tool-level child spans via SpansClient, linked to the current
trace context via contextvars.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .._context import get_trace_context
from ..clients.spans import SpansClient
from ._serialize import to_text
from ._types import Hooks


def create_tool_tracing_hooks(spans_client: SpansClient) -> Hooks:
    """Create hooks that manage tool-level child spans.

    Reads the current trace context (set by ``Opper.trace_async()``) to
    determine parent span and trace IDs. If no context is active, hooks
    are no-ops.
    """
    tool_spans: dict[str, str] = {}

    async def on_tool_start(ctx: dict[str, Any]) -> None:
        trace_ctx = get_trace_context()
        if not trace_ctx:
            return

        try:
            span = await spans_client.create_async(
                name=ctx["name"],
                start_time=datetime.now(timezone.utc).isoformat(),
                input=to_text(ctx.get("input")),
                trace_id=trace_ctx.trace_id,
                parent_id=trace_ctx.span_id,
            )
            tool_spans[ctx["call_id"]] = span.id
        except Exception:
            # Tracing failures should never break the agent
            pass

    async def on_tool_end(ctx: dict[str, Any]) -> None:
        span_id = tool_spans.pop(ctx.get("call_id", ""), None)
        if not span_id:
            return

        try:
            update_kwargs: dict[str, Any] = {
                "end_time": datetime.now(timezone.utc).isoformat(),
            }
            if ctx.get("error"):
                update_kwargs["error"] = ctx["error"]
            if ctx.get("output") is not None:
                update_kwargs["output"] = to_text(ctx["output"])
            await spans_client.update_async(span_id, **update_kwargs)
        except Exception:
            # Tracing failures should never break the agent
            pass

    return Hooks(on_tool_start=on_tool_start, on_tool_end=on_tool_end)
