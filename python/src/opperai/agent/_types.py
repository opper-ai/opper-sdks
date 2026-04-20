"""Agent SDK — Type definitions.

OpenResponses wire types (OR*) and agent-layer types (AgentTool, RunResult, etc.).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, Union, runtime_checkable

from ..types import Model

# =============================================================================
# OpenResponses Wire Types — Request
# =============================================================================


@dataclass(frozen=True)
class ORTool:
    """Tool definition sent to the OpenResponses endpoint."""

    type: Literal["function"] = "function"
    name: str = ""
    description: str = ""
    parameters: dict[str, Any] | None = None
    strict: bool | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type, "name": self.name}
        if self.description:
            d["description"] = self.description
        if self.parameters is not None:
            d["parameters"] = self.parameters
        if self.strict is not None:
            d["strict"] = self.strict
        return d


# --- Input items ---

ORInputItem = Union["ORMessageInputItem", "ORFunctionCallInputItem", "ORFunctionCallOutputItem"]


@dataclass(frozen=True)
class ORMessageInputItem:
    """A message item in the input array."""

    type: Literal["message"] = "message"
    role: Literal["user", "assistant", "system", "developer"] = "user"
    content: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "role": self.role, "content": self.content}


@dataclass(frozen=True)
class ORFunctionCallInputItem:
    """A function call echoed back to the server in the items array."""

    type: Literal["function_call"] = "function_call"
    call_id: str = ""
    name: str = ""
    arguments: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "call_id": self.call_id,
            "name": self.name,
            "arguments": self.arguments,
        }


@dataclass(frozen=True)
class ORFunctionCallOutputItem:
    """A tool result sent back to the server."""

    type: Literal["function_call_output"] = "function_call_output"
    call_id: str = ""
    output: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "call_id": self.call_id, "output": self.output}


def input_item_to_dict(item: ORInputItem) -> dict[str, Any]:
    """Convert any ORInputItem to a plain dict for JSON serialization."""
    return item.to_dict()


# =============================================================================
# OpenResponses Wire Types — Response
# =============================================================================

# Response types are plain dicts parsed from JSON — no dataclasses needed.
# We define type aliases for documentation purposes.

# ORResponse = dict with keys: id, object, status, output, usage, error, ...
# OROutputItem = dict with key "type" in {"message", "function_call", "reasoning"}
# ORUsage = dict with keys: input_tokens, output_tokens, total_tokens, ...

# =============================================================================
# OpenResponses Wire Types — Streaming Events
# =============================================================================

# SSE events are also plain dicts. The event type is in the "type" field:
#   "response.created"
#   "response.in_progress"
#   "response.completed"
#   "response.failed"
#   "response.incomplete"
#   "response.output_item.added"
#   "response.output_item.done"
#   "response.content_part.added"
#   "response.content_part.done"
#   "response.output_text.delta"
#   "response.output_text.done"
#   "response.function_call_arguments.delta"
#   "response.function_call_arguments.done"
#   "response.reasoning_summary_text.delta"
#   "response.reasoning_summary_text.done"
#   "error"

# =============================================================================
# Agent Layer Types
# =============================================================================


@dataclass(frozen=True)
class AgentTool:
    """A resolved agent tool with name, description, parameters, and execute function."""

    name: str
    description: str = ""
    parameters: dict[str, Any] | None = None
    timeout_ms: int | None = None
    execute: Callable[..., Any] = field(default=lambda _: None, repr=False)
    _sub_agent: bool = field(default=False, repr=False)


@runtime_checkable
class ToolProvider(Protocol):
    """Protocol for dynamic tool sources (e.g. MCP servers)."""

    async def setup(self) -> list[AgentTool]: ...
    async def teardown(self) -> None: ...


def is_tool_provider(t: AgentTool | ToolProvider) -> bool:
    """Check if an object is a ToolProvider (not a plain AgentTool)."""
    return isinstance(t, ToolProvider) and not isinstance(t, AgentTool)


@dataclass(frozen=True)
class RetryPolicy:
    """Retry policy for transient LLM call failures."""

    max_retries: int = 2
    initial_delay_ms: int = 1000
    backoff_multiplier: float = 2.0


# =============================================================================
# Result Types
# =============================================================================


@dataclass(frozen=True)
class AggregatedUsage:
    """Aggregated token usage across all iterations."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int | None = None
    reasoning_tokens: int | None = None


@dataclass(frozen=True)
class ToolCallRecord:
    """Record of a single tool call made during the run."""

    name: str
    call_id: str
    input: Any = None
    output: Any = None
    error: str | None = None
    duration_ms: float = 0.0


@dataclass(frozen=True)
class RunMeta:
    """Metadata from an agent run."""

    usage: AggregatedUsage = field(default_factory=AggregatedUsage)
    iterations: int = 0
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    response_id: str | None = None
    reasoning: list[str] | None = None


@dataclass(frozen=True)
class RunResult:
    """The result of running an agent."""

    output: Any = None
    meta: RunMeta = field(default_factory=RunMeta)


# =============================================================================
# Per-Run Options
# =============================================================================


@dataclass
class RunOptions:
    """Per-run overrides passed to agent.run() / agent.stream()."""

    model: Model | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    max_iterations: int | None = None
    reasoning_effort: Literal["low", "medium", "high"] | None = None
    parent_span_id: str | None = None


# =============================================================================
# Hooks — Lifecycle Observability
# =============================================================================


@dataclass
class Hooks:
    """Lifecycle hooks for observing agent execution.

    All hooks are optional. Hooks can be sync or async functions.
    Hook errors are caught and warned — they never crash the loop.

    Hook signatures receive a dict with context-specific keys:
        on_agent_start:     {"agent": str, "input": str | list}
        on_agent_end:       {"agent": str, "result": RunResult | None, "error": Exception | None}
        on_iteration_start: {"agent": str, "iteration": int}
        on_iteration_end:   {"agent": str, "iteration": int, "usage": AggregatedUsage}
        on_llm_call:        {"agent": str, "iteration": int, "request": dict}
        on_llm_response:    {"agent": str, "iteration": int, "response": dict}
        on_tool_start:      {"agent": str, "iteration": int, "name": str, "call_id": str, "input": Any}
        on_tool_end:        {"agent": str, "iteration": int, "name": str, "call_id": str,
                             "output": Any, "error": str | None, "duration_ms": float}
        on_error:           {"agent": str, "iteration": int, "error": Exception, "will_retry": bool}
    """

    on_agent_start: Callable[..., Any] | None = None
    on_agent_end: Callable[..., Any] | None = None
    on_iteration_start: Callable[..., Any] | None = None
    on_iteration_end: Callable[..., Any] | None = None
    on_llm_call: Callable[..., Any] | None = None
    on_llm_response: Callable[..., Any] | None = None
    on_tool_start: Callable[..., Any] | None = None
    on_tool_end: Callable[..., Any] | None = None
    on_error: Callable[..., Any] | None = None


# =============================================================================
# Streaming — User-Facing Events
# =============================================================================


@dataclass(frozen=True)
class IterationStartEvent:
    """Fired at the beginning of each loop iteration."""

    type: Literal["iteration_start"] = "iteration_start"
    iteration: int = 0


@dataclass(frozen=True)
class TextDeltaEvent:
    """Incremental text from the model."""

    type: Literal["text_delta"] = "text_delta"
    text: str = ""


@dataclass(frozen=True)
class ReasoningDeltaEvent:
    """Reasoning/thinking content from the model."""

    type: Literal["reasoning_delta"] = "reasoning_delta"
    text: str = ""


@dataclass(frozen=True)
class ToolStartEvent:
    """Fired when a tool call is fully received and about to execute."""

    type: Literal["tool_start"] = "tool_start"
    name: str = ""
    call_id: str = ""
    input: Any = None


@dataclass(frozen=True)
class ToolEndEvent:
    """Fired after a tool execution completes."""

    type: Literal["tool_end"] = "tool_end"
    name: str = ""
    call_id: str = ""
    output: Any = None
    error: str | None = None
    duration_ms: float = 0.0


@dataclass(frozen=True)
class IterationEndEvent:
    """Fired at the end of each loop iteration."""

    type: Literal["iteration_end"] = "iteration_end"
    iteration: int = 0
    usage: AggregatedUsage | None = None


@dataclass(frozen=True)
class ResultEvent:
    """Final result of the agent run."""

    type: Literal["result"] = "result"
    output: Any = None
    meta: RunMeta = field(default_factory=RunMeta)


@dataclass(frozen=True)
class StreamErrorEvent:
    """Unrecoverable error during the agent run."""

    type: Literal["error"] = "error"
    error: Exception = field(default_factory=lambda: Exception("unknown"))


AgentStreamEvent = (
    IterationStartEvent
    | TextDeltaEvent
    | ReasoningDeltaEvent
    | ToolStartEvent
    | ToolEndEvent
    | IterationEndEvent
    | ResultEvent
    | StreamErrorEvent
)
