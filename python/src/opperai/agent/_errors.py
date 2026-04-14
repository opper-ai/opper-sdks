"""Agent SDK — Error classes."""

from __future__ import annotations

from typing import Any


class AgentError(Exception):
    """Base error for all agent-related failures."""

    def __init__(self, message: str, *, cause: BaseException | None = None) -> None:
        super().__init__(message)
        if cause is not None:
            self.__cause__ = cause


class MaxIterationsError(AgentError):
    """Raised when the agent hits its iteration limit without completing."""

    def __init__(
        self,
        iterations: int,
        last_output: Any = None,
        tool_calls: list[Any] | None = None,
    ) -> None:
        super().__init__(
            f"Agent reached max iterations ({iterations}) without producing a final answer"
        )
        self.iterations = iterations
        self.last_output = last_output
        self.tool_calls = tool_calls or []


class AbortError(AgentError):
    """Raised when an agent run is cancelled."""

    def __init__(self) -> None:
        super().__init__("Agent run was aborted")
