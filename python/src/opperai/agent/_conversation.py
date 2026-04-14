"""Agent SDK — Conversation (multi-turn state management)."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from ._stream import AgentStream
from ._types import ResultEvent, RunResult

if TYPE_CHECKING:
    from . import Agent


class Conversation:
    """Stateful multi-turn conversation with an agent.

    Tracks full items history across ``.send()`` calls so the agent
    sees prior turns as context.

    Example::

        conv = agent.conversation()
        r1 = await conv.send("My name is Alice.")
        r2 = await conv.send("What's my name?")  # Remembers "Alice"

        conv.clear()  # Reset history
    """

    def __init__(self, agent: Agent) -> None:
        self._agent = agent
        self._items: list[dict[str, Any]] = []

    async def send(self, input: str, **kwargs: Any) -> RunResult:
        """Send a message and get a response."""
        self._items.append({
            "type": "message",
            "role": "user",
            "content": input,
        })

        result = await self._agent.run(list(self._items), **kwargs)

        # Append tool calls and assistant response to history
        for tc in result.meta.tool_calls:
            self._items.append({
                "type": "function_call",
                "call_id": tc.call_id,
                "name": tc.name,
                "arguments": json.dumps(tc.input) if tc.input is not None else "",
            })
            output = (
                json.dumps({"error": tc.error})
                if tc.error
                else json.dumps(tc.output)
            )
            self._items.append({
                "type": "function_call_output",
                "call_id": tc.call_id,
                "output": output,
            })

        # Append assistant output
        output_text = (
            result.output
            if isinstance(result.output, str)
            else json.dumps(result.output)
        )
        self._items.append({
            "type": "message",
            "role": "assistant",
            "content": output_text or "",
        })

        return result

    def stream(self, input: str, **kwargs: Any) -> AgentStream:
        """Stream a conversation turn."""
        return AgentStream(self._stream_generator(input, kwargs))

    async def _stream_generator(self, input: str, kwargs: dict[str, Any]) -> Any:
        """Create the streaming generator and update items on completion."""
        self._items.append({
            "type": "message",
            "role": "user",
            "content": input,
        })

        stream = self._agent.stream(list(self._items), **kwargs)
        result: RunResult | None = None

        async for event in stream:
            if isinstance(event, ResultEvent):
                result = RunResult(output=event.output, meta=event.meta)
            yield event

        # Update history after stream completes
        if result:
            for tc in result.meta.tool_calls:
                self._items.append({
                    "type": "function_call",
                    "call_id": tc.call_id,
                    "name": tc.name,
                    "arguments": json.dumps(tc.input) if tc.input is not None else "",
                })
                output = (
                    json.dumps({"error": tc.error})
                    if tc.error
                    else json.dumps(tc.output)
                )
                self._items.append({
                    "type": "function_call_output",
                    "call_id": tc.call_id,
                    "output": output,
                })

            output_text = (
                result.output
                if isinstance(result.output, str)
                else json.dumps(result.output)
            )
            self._items.append({
                "type": "message",
                "role": "assistant",
                "content": output_text or "",
            })

    def get_items(self) -> list[dict[str, Any]]:
        """Return a copy of the accumulated items."""
        return list(self._items)

    def clear(self) -> None:
        """Reset the conversation history."""
        self._items.clear()
