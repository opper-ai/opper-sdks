"""Beta decorator for Opper SDK methods.

Marks a method as targeting a beta API endpoint. On first call per method
the decorator emits a one-time ``FutureWarning`` so users know the contract
may change. Suppress with standard ``warnings`` filters::

    import warnings
    from opperai._beta import BetaWarning
    warnings.simplefilter("ignore", BetaWarning)
"""

from __future__ import annotations

import functools
import inspect
import warnings
from collections.abc import Callable
from typing import Any, TypeVar

F = TypeVar("F", bound=Callable[..., Any])


class BetaWarning(FutureWarning):
    """Emitted once per @beta-decorated method when first called."""


def beta(fn: F) -> F:
    """Decorate a method that targets a beta API endpoint.

    Emits a one-time ``BetaWarning`` on first call. Works on sync and async
    methods. Docstring is prefixed with a ``[BETA]`` marker so ``help()`` and
    IDE hover surface the status.
    """
    warned = False
    qualname = getattr(fn, "__qualname__", getattr(fn, "__name__", "<beta>"))

    def _warn_once() -> None:
        nonlocal warned
        if warned:
            return
        warned = True
        warnings.warn(
            f"{qualname} targets a beta API endpoint. Behavior may change without a major version bump.",
            BetaWarning,
            stacklevel=3,
        )

    if inspect.iscoroutinefunction(fn):

        @functools.wraps(fn)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            _warn_once()
            return await fn(*args, **kwargs)

        _prefix_doc(async_wrapper, fn)
        return async_wrapper  # type: ignore[return-value]

    @functools.wraps(fn)
    def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
        _warn_once()
        return fn(*args, **kwargs)

    _prefix_doc(sync_wrapper, fn)
    return sync_wrapper  # type: ignore[return-value]


def _prefix_doc(wrapper: Callable[..., Any], original: Callable[..., Any]) -> None:
    doc = original.__doc__ or ""
    wrapper.__doc__ = "[BETA] " + doc if doc else "[BETA] Beta API method."
