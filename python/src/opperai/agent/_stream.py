"""Agent SDK — AgentStream class.

Wraps the internal async generator for user consumption.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from ._errors import AgentError
from ._types import AgentStreamEvent, ResultEvent, RunResult


class AgentStream:
    """Async stream of agent events.

    Usage::

        stream = agent.stream("question")
        async for event in stream:
            if event.type == "text_delta":
                print(event.text, end="")
        result = await stream.result()

    Can only be iterated once.
    """

    def __init__(self, generator: Any) -> None:
        self._generator = generator
        self._result: RunResult | None = None
        self._error: BaseException | None = None
        self._iterated = False

    def __aiter__(self) -> AsyncIterator[AgentStreamEvent]:
        if self._iterated:
            raise RuntimeError("AgentStream can only be iterated once")
        self._iterated = True
        return self._aiter_impl()

    async def _aiter_impl(self) -> AsyncIterator[AgentStreamEvent]:
        try:
            async for event in self._generator:
                if isinstance(event, ResultEvent):
                    self._result = RunResult(output=event.output, meta=event.meta)
                yield event
        except BaseException as exc:
            self._error = exc
            raise

    async def result(self) -> RunResult:
        """Get the final result. Drains the stream if not yet iterated."""
        if self._result is not None:
            return self._result
        if self._error is not None:
            raise self._error
        if not self._iterated:
            async for _ in self:
                pass
        if self._result is None:
            if self._error is not None:
                raise self._error
            raise AgentError("Stream ended without producing a result")
        return self._result
