"""Agent SDK — Hook dispatch utilities."""

from __future__ import annotations

import inspect
import warnings
from typing import Any

from ._types import Hooks


async def dispatch_hook(hooks: Hooks | None, name: str, ctx: dict[str, Any]) -> None:
    """Safely dispatch a lifecycle hook. Swallows errors."""
    if hooks is None:
        return
    fn = getattr(hooks, name, None)
    if fn is None:
        return
    try:
        if inspect.iscoroutinefunction(fn):
            await fn(ctx)
        else:
            fn(ctx)
    except Exception as exc:
        warnings.warn(
            f'[opper] Hook "{name}" raised: {exc}',
            RuntimeWarning,
            stacklevel=2,
        )


def merge_hooks(a: Hooks | None, b: Hooks | None) -> Hooks | None:
    """Merge two Hooks objects. Both fire for each event (a first, then b)."""
    if not a and not b:
        return None
    if not a:
        return b
    if not b:
        return a

    merged = Hooks()
    for key in _HOOK_KEYS:
        fa = getattr(a, key, None)
        fb = getattr(b, key, None)
        if fa and fb:

            async def combined(ctx: dict[str, Any], _fa: Any = fa, _fb: Any = fb) -> None:
                try:
                    if inspect.iscoroutinefunction(_fa):
                        await _fa(ctx)
                    else:
                        _fa(ctx)
                except Exception as exc:
                    warnings.warn(
                        f"[opper] Hook raised: {exc}",
                        RuntimeWarning,
                        stacklevel=2,
                    )
                try:
                    if inspect.iscoroutinefunction(_fb):
                        await _fb(ctx)
                    else:
                        _fb(ctx)
                except Exception as exc:
                    warnings.warn(
                        f"[opper] Hook raised: {exc}",
                        RuntimeWarning,
                        stacklevel=2,
                    )

            setattr(merged, key, combined)
        elif fa or fb:
            setattr(merged, key, fa or fb)
    return merged


_HOOK_KEYS = [
    "on_agent_start",
    "on_agent_end",
    "on_iteration_start",
    "on_iteration_end",
    "on_llm_call",
    "on_llm_response",
    "on_tool_start",
    "on_tool_end",
    "on_error",
]
