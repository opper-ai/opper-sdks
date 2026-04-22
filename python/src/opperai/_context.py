"""Opper SDK — Trace context propagation via contextvars."""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass


@dataclass(frozen=True)
class TraceContext:
    """Holds the current span ID and trace ID for automatic propagation."""

    span_id: str
    trace_id: str
    is_tool_span: bool = False


_trace_context: ContextVar[TraceContext | None] = ContextVar("_opper_trace_context", default=None)


def get_trace_context() -> TraceContext | None:
    """Get the current trace context, if any."""
    return _trace_context.get()


def set_trace_context(ctx: TraceContext | None) -> None:
    """Set the current trace context."""
    _trace_context.set(ctx)
