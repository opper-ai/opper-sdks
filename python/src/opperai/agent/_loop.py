"""Agent SDK — Agentic loop (always-streaming-internally).

Single ``_stream_loop()`` async generator. ``run()`` drains it;
``stream()`` exposes it to the caller.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any, Literal

from ..types import (
    ApiError,
    AuthenticationError,
    InternalServerError,
    Model,
    RateLimitError,
    RequestOptions,
)
from ._errors import AbortError, AgentError, MaxIterationsError
from ._hooks import dispatch_hook
from ._reasoning import accumulate_reasoning, extract_reasoning
from ._serialize import to_json_str
from ._turn_awareness import get_warning_message, is_recovery_turn
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
    TextDeltaEvent,
    ToolCallRecord,
    ToolEndEvent,
    ToolStartEvent,
)

# =============================================================================
# Internal config (resolved from AgentConfig + RunOptions)
# =============================================================================


@dataclass
class LoopConfig:
    """Internal config passed to the streaming loop."""

    name: str
    trace_name: str
    instructions: str
    tools: list[AgentTool]
    model: Model | None = None
    output_schema: dict[str, Any] | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    max_iterations: int = 25
    reasoning_effort: Literal["low", "medium", "high"] | None = None
    parallel_tool_execution: bool = True
    hooks: Hooks | None = None
    trace_context: dict[str, str] | None = None
    retry: RetryPolicy | None = None
    on_max_iterations: Literal["throw", "return_partial"] = "throw"


# =============================================================================
# Helpers
# =============================================================================


def _to_or_tool(t: AgentTool) -> dict[str, Any]:
    """Convert an AgentTool to the ORTool wire format dict."""
    d: dict[str, Any] = {"type": "function", "name": t.name}
    if t.description:
        d["description"] = t.description
    if t.parameters is not None:
        d["parameters"] = t.parameters
    return d


def _extract_text(output: list[dict[str, Any]]) -> str | None:
    """Extract text from assistant message output items."""
    for item in output:
        if item.get("type") == "message" and item.get("role") == "assistant":
            for part in item.get("content", []):
                if part.get("type") == "output_text" and part.get("text"):
                    return part["text"]
    return None


def _add_usage(agg: dict[str, Any], usage: dict[str, Any] | None) -> None:
    """Accumulate usage from a response into running totals."""
    if not usage:
        return
    agg["input_tokens"] += usage.get("input_tokens", 0)
    agg["output_tokens"] += usage.get("output_tokens", 0)
    agg["total_tokens"] += usage.get("total_tokens", 0)
    cached = (usage.get("input_tokens_details") or {}).get("cached_tokens")
    if cached:
        agg["cached_tokens"] = (agg.get("cached_tokens") or 0) + cached
    reasoning = (usage.get("output_tokens_details") or {}).get("reasoning_tokens")
    if reasoning:
        agg["reasoning_tokens"] = (agg.get("reasoning_tokens") or 0) + reasoning


def _usage_to_aggregated(usage: dict[str, Any]) -> AggregatedUsage:
    """Convert the mutable usage dict to a frozen AggregatedUsage."""
    return AggregatedUsage(
        input_tokens=usage.get("input_tokens", 0),
        output_tokens=usage.get("output_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
        cached_tokens=usage.get("cached_tokens"),
        reasoning_tokens=usage.get("reasoning_tokens"),
    )


def _build_request(
    config: LoopConfig,
    items: list[dict[str, Any]],
    or_tools: list[dict[str, Any]],
    options: RunOptions | None = None,
) -> dict[str, Any]:
    """Build the ORRequest dict from config, items, and per-run options."""
    req: dict[str, Any] = {"input": items, "instructions": config.instructions}

    if or_tools:
        req["tools"] = or_tools

    model = (options.model if options else None) or config.model
    if model:
        req["model"] = model

    temp = (options.temperature if options else None) or config.temperature
    if temp is not None:
        req["temperature"] = temp

    max_tokens = (options.max_tokens if options else None) or config.max_tokens
    if max_tokens is not None:
        req["max_output_tokens"] = max_tokens

    reasoning = (options.reasoning_effort if options else None) or config.reasoning_effort
    if reasoning:
        req["reasoning"] = {"effort": reasoning}

    if config.output_schema:
        req["text"] = {
            "format": {
                "type": "json_schema",
                "name": "output",
                "schema": config.output_schema,
            }
        }

    return req


def _parse_output(text: str | None, output_schema: dict[str, Any] | None) -> Any:
    """Parse output text, attempting JSON parse when output_schema is set."""
    if output_schema and text:
        try:
            return json.loads(text)
        except (json.JSONDecodeError, ValueError):
            return text
    return text


def _with_tracing_headers(
    trace_name: str,
    trace_context: dict[str, str] | None,
    options: RequestOptions | None = None,
) -> RequestOptions | None:
    """Merge tracing headers into request options."""
    if not trace_context:
        return options
    headers = {
        "X-Opper-Parent-Span-Id": trace_context["span_id"],
        "X-Opper-Name": trace_name,
    }
    if options and options.headers:
        headers = {**options.headers, **headers}
    return RequestOptions(headers=headers, timeout=options.timeout if options else None)


# =============================================================================
# Error recovery
# =============================================================================


def _is_retryable(err: BaseException) -> bool:
    """Return True if the error is transient and worth retrying."""
    if isinstance(err, AuthenticationError):
        return False
    if isinstance(err, (RateLimitError, InternalServerError)):
        return True
    if isinstance(err, (ConnectionError, TimeoutError, OSError)):
        return True
    return False


def _is_fatal(err: BaseException) -> bool:
    """Return True if the error should never be recovered."""
    if isinstance(err, (AbortError, AuthenticationError)):
        return True
    # 4xx client errors (except 408 Request Timeout and 429 Too Many Requests,
    # which are transient) won't be fixed by retries or by injecting the error
    # as in-context "recovery" feedback — the same request fails every
    # iteration. Surface immediately so the caller sees the real message.
    if isinstance(err, ApiError):
        status = err.status
        if 400 <= status < 500 and status not in (408, 429):
            return True
    return False


async def _with_retry(
    fn: Any,
    policy: RetryPolicy,
    hooks: Hooks | None,
    agent_name: str,
    iteration: int,
) -> Any:
    """Retry an async callable with exponential backoff."""
    delay = policy.initial_delay_ms / 1000.0

    last_error: BaseException | None = None
    for attempt in range(policy.max_retries + 1):
        try:
            return await fn()
        except BaseException as err:
            last_error = err
            if not _is_retryable(err) or attempt == policy.max_retries:
                raise
            await dispatch_hook(hooks, "on_error", {
                "agent": agent_name,
                "iteration": iteration,
                "error": err,
                "will_retry": True,
            })
            await asyncio.sleep(delay)
            delay *= policy.backoff_multiplier

    raise last_error  # type: ignore[misc]


def _error_to_item(message: str) -> dict[str, Any]:
    """Create a system message item to inject a recovered error."""
    return {
        "type": "message",
        "role": "system",
        "content": f"[Error] {message} — adjust your approach or inform the user.",
    }


# =============================================================================
# Tool execution
# =============================================================================


async def _execute_tool(
    tools: list[AgentTool],
    call_id: str,
    name: str,
    args_json: str,
) -> ToolCallRecord:
    """Execute a single tool call, returning a ToolCallRecord."""
    start = time.monotonic()
    tool = next((t for t in tools if t.name == name), None)

    if tool is None:
        return ToolCallRecord(
            name=name,
            call_id=call_id,
            input=args_json,
            error=f'Tool "{name}" not found',
            duration_ms=(time.monotonic() - start) * 1000,
        )

    try:
        parsed = json.loads(args_json) if args_json else {}
    except (json.JSONDecodeError, ValueError):
        return ToolCallRecord(
            name=name,
            call_id=call_id,
            input=args_json,
            error=f"Failed to parse tool arguments: {args_json}",
            duration_ms=(time.monotonic() - start) * 1000,
        )

    try:
        # Unpack dict as keyword arguments for Pythonic tool functions
        if isinstance(parsed, dict):
            result = tool.execute(**parsed)
        else:
            result = tool.execute(parsed)
        if asyncio.iscoroutine(result):
            result = await result
        return ToolCallRecord(
            name=name,
            call_id=call_id,
            input=parsed,
            output=result,
            duration_ms=(time.monotonic() - start) * 1000,
        )
    except Exception as exc:
        return ToolCallRecord(
            name=name,
            call_id=call_id,
            input=parsed,
            error=str(exc),
            duration_ms=(time.monotonic() - start) * 1000,
        )


async def _execute_tools_with_hooks(
    tools: list[AgentTool],
    function_calls: list[dict[str, Any]],
    parallel: bool,
    hooks: Hooks | None,
    agent_name: str,
    iteration: int,
) -> list[ToolCallRecord]:
    """Execute tool calls with hook dispatch around each tool."""

    async def run_one(fc: dict[str, Any]) -> ToolCallRecord:
        try:
            parsed = json.loads(fc.get("arguments", "{}")) if fc.get("arguments") else {}
        except (json.JSONDecodeError, ValueError):
            parsed = fc.get("arguments", "")

        await dispatch_hook(hooks, "on_tool_start", {
            "agent": agent_name,
            "iteration": iteration,
            "name": fc["name"],
            "call_id": fc["call_id"],
            "input": parsed,
        })

        record = await _execute_tool(tools, fc["call_id"], fc["name"], fc.get("arguments", ""))

        await dispatch_hook(hooks, "on_tool_end", {
            "agent": agent_name,
            "iteration": iteration,
            "name": fc["name"],
            "call_id": fc["call_id"],
            "output": record.output,
            "error": record.error,
            "duration_ms": record.duration_ms,
        })

        return record

    if parallel:
        return list(await asyncio.gather(*(run_one(fc) for fc in function_calls)))
    return [await run_one(fc) for fc in function_calls]


def _append_tool_results(
    items: list[dict[str, Any]],
    function_calls: list[dict[str, Any]],
    tool_records: list[ToolCallRecord],
) -> None:
    """Append function calls and their results to the items array."""
    for fc in function_calls:
        items.append({
            "type": "function_call",
            "call_id": fc["call_id"],
            "name": fc["name"],
            "arguments": fc.get("arguments", ""),
        })
    for record in tool_records:
        output = (
            to_json_str({"error": record.error})
            if record.error
            else to_json_str(record.output)
        )
        items.append({
            "type": "function_call_output",
            "call_id": record.call_id,
            "output": output,
        })


# =============================================================================
# SSE stream consumer
# =============================================================================


async def _consume_stream(
    stream: AsyncGenerator[dict[str, Any], None],
) -> AsyncGenerator[
    AgentStreamEvent | dict[str, Any],
    None,
]:
    """Process an SSE stream from the OpenResponses endpoint.

    Yields user-facing AgentStreamEvent objects (text_delta, reasoning_delta)
    and internal ``{"_tool_ready": ...}`` dicts for completed tool calls.

    After the generator is exhausted, call ``.response`` / ``.function_calls``
    on the returned state. We use a mutable state holder instead of generator
    return value because Python doesn't natively support ``return`` values
    from ``async for``.
    """
    pending_calls: dict[int, dict[str, Any]] = {}
    completed_response: dict[str, Any] | None = None
    reasoning_text = ""

    async for event in stream:
        event_type = event.get("type", "")

        if event_type == "response.output_text.delta":
            yield TextDeltaEvent(text=event.get("delta", ""))

        elif event_type == "response.reasoning_summary_text.delta":
            yield ReasoningDeltaEvent(text=event.get("delta", ""))

        elif event_type == "response.reasoning_summary_text.done":
            reasoning_text = event.get("text", "")

        elif event_type == "response.function_call_arguments.delta":
            idx = event.get("output_index", 0)
            existing = pending_calls.get(idx)
            if existing:
                existing["arguments"] += event.get("delta", "")

        elif event_type == "response.function_call_arguments.done":
            idx = event.get("output_index", 0)
            existing = pending_calls.get(idx)
            if existing:
                existing["arguments"] = event.get("arguments", "")
                yield {
                    "_tool_ready": True,
                    "call": {
                        "type": "function_call",
                        "id": f"fc_{idx}",
                        "call_id": existing["call_id"],
                        "name": existing["name"],
                        "arguments": existing["arguments"],
                        "status": "completed",
                    },
                }

        elif event_type == "response.output_item.added":
            item = event.get("item", {})
            if item.get("type") == "function_call":
                idx = event.get("output_index", 0)
                pending_calls[idx] = {
                    "call_id": item.get("call_id", ""),
                    "name": item.get("name", ""),
                    "arguments": "",
                    "output_index": idx,
                }

        elif event_type in (
            "response.completed",
            "response.failed",
            "response.incomplete",
        ):
            completed_response = event.get("response")

        elif event_type == "error":
            err_info = event.get("error", {})
            raise AgentError(f"Stream error: {err_info.get('message', 'unknown')}")

    # Store final state in a sentinel event
    function_calls = []
    for pending in pending_calls.values():
        function_calls.append({
            "type": "function_call",
            "id": f"fc_{pending['output_index']}",
            "call_id": pending["call_id"],
            "name": pending["name"],
            "arguments": pending["arguments"],
            "status": "completed",
        })

    yield {
        "_stream_done": True,
        "response": completed_response,
        "function_calls": function_calls,
        "reasoning_text": reasoning_text or None,
    }


# =============================================================================
# The agentic loop
# =============================================================================


async def stream_loop(
    client: Any,
    config: LoopConfig,
    input: str | list[dict[str, Any]],
    options: RunOptions | None = None,
) -> AsyncGenerator[AgentStreamEvent, None]:
    """Core agentic loop. Always streams internally.

    Yields ``AgentStreamEvent`` objects. ``Agent.run_async()`` drains this;
    ``Agent.stream_async()`` exposes it to the caller.
    """
    or_tools = [_to_or_tool(t) for t in config.tools]

    items: list[dict[str, Any]] = (
        [{"type": "message", "role": "user", "content": input}]
        if isinstance(input, str)
        else [_item_to_dict(i) for i in input]
    )

    usage: dict[str, Any] = {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
    }
    all_tool_calls: list[ToolCallRecord] = []
    all_reasoning: list[str] = []
    max_iterations = (options.max_iterations if options else None) or config.max_iterations
    hooks = config.hooks
    response_id: str | None = None
    last_iteration_called_tools = False

    await dispatch_hook(hooks, "on_agent_start", {"agent": config.name, "input": input})

    try:
        for iteration in range(1, max_iterations + 2):
            # Recovery turn: only if previous iteration called tools
            if is_recovery_turn(iteration, max_iterations) and not last_iteration_called_tools:
                break

            await dispatch_hook(hooks, "on_iteration_start", {
                "agent": config.name,
                "iteration": iteration,
            })
            yield IterationStartEvent(iteration=iteration)

            # Turn awareness
            warning = get_warning_message(iteration, max_iterations)
            if warning:
                items.append({"type": "message", "role": "developer", "content": warning})

            request = _build_request(config, items, or_tools, options)
            req_options = _with_tracing_headers(
                config.trace_name, config.trace_context,
            )

            await dispatch_hook(hooks, "on_llm_call", {
                "agent": config.name,
                "iteration": iteration,
                "request": request,
            })

            # --- Stream consumption ---
            response: dict[str, Any] | None = None
            function_calls: list[dict[str, Any]] = []
            tool_records: list[ToolCallRecord] = []
            stream_recovered = False

            if config.retry:
                # Buffer + retry path
                try:
                    buffered = await _with_retry(
                        lambda: _buffer_stream(client, request, req_options),
                        config.retry,
                        hooks,
                        config.name,
                        iteration,
                    )
                    for ev in buffered["events"]:
                        yield ev
                    response = buffered["response"]
                    function_calls = buffered["function_calls"]
                    if buffered.get("reasoning_text"):
                        accumulate_reasoning(all_reasoning, buffered["reasoning_text"])
                except BaseException as err:
                    if _is_fatal(err):
                        raise
                    await dispatch_hook(hooks, "on_error", {
                        "agent": config.name,
                        "iteration": iteration,
                        "error": err,
                        "will_retry": False,
                    })
                    items.append(_error_to_item(str(err)))
                    stream_recovered = True
            else:
                # Non-retry: stream events with eager tool execution
                try:
                    sse_stream = await client.create_stream_async(request, req_options)
                except BaseException as err:
                    raise AgentError("Server call failed", cause=err) from err

                eager_function_calls: list[dict[str, Any]] = []
                tool_tasks: list[asyncio.Task[tuple[dict[str, Any], ToolCallRecord, list[AgentStreamEvent]]]] = []

                consumer = _consume_stream(sse_stream)
                async for event in consumer:
                    if isinstance(event, dict) and event.get("_tool_ready"):
                        fc = event["call"]
                        eager_function_calls.append(fc)

                        async def _run_eager_tool(
                            _fc: dict[str, Any] = fc,
                        ) -> tuple[dict[str, Any], ToolCallRecord, list[AgentStreamEvent]]:
                            try:
                                parsed = json.loads(_fc.get("arguments", "{}")) if _fc.get("arguments") else {}
                            except (json.JSONDecodeError, ValueError):
                                parsed = _fc.get("arguments", "")

                            await dispatch_hook(hooks, "on_tool_start", {
                                "agent": config.name,
                                "iteration": iteration,
                                "name": _fc["name"],
                                "call_id": _fc["call_id"],
                                "input": parsed,
                            })

                            record = await _execute_tool(
                                config.tools, _fc["call_id"], _fc["name"], _fc.get("arguments", ""),
                            )

                            await dispatch_hook(hooks, "on_tool_end", {
                                "agent": config.name,
                                "iteration": iteration,
                                "name": _fc["name"],
                                "call_id": _fc["call_id"],
                                "output": record.output,
                                "error": record.error,
                                "duration_ms": record.duration_ms,
                            })

                            events: list[AgentStreamEvent] = [
                                ToolStartEvent(
                                    name=_fc["name"],
                                    call_id=_fc["call_id"],
                                    input=parsed,
                                ),
                                ToolEndEvent(
                                    name=_fc["name"],
                                    call_id=_fc["call_id"],
                                    output=record.output,
                                    error=record.error,
                                    duration_ms=record.duration_ms,
                                ),
                            ]
                            return (_fc, record, events)

                        if config.parallel_tool_execution:
                            tool_tasks.append(asyncio.create_task(_run_eager_tool(fc)))
                        else:
                            _, record, tool_events = await _run_eager_tool(fc)
                            for ev in tool_events:
                                yield ev
                            tool_records.append(record)

                    elif isinstance(event, dict) and event.get("_stream_done"):
                        response = event.get("response")
                        if not eager_function_calls:
                            function_calls = event.get("function_calls", [])
                        else:
                            function_calls = eager_function_calls
                        if event.get("reasoning_text"):
                            accumulate_reasoning(all_reasoning, event["reasoning_text"])
                    else:
                        yield event  # type: ignore[misc]

                # Await parallel tool tasks
                if tool_tasks:
                    results = await asyncio.gather(*tool_tasks)
                    for _, record, tool_events in results:
                        for ev in tool_events:
                            yield ev
                        tool_records.append(record)

            if stream_recovered:
                continue

            # Every successful iteration must end with a final response frame
            # (response.completed / response.failed / response.incomplete). If
            # the stream closed without one we have no usage, no output, and
            # no way to make forward progress — raise so the caller sees the
            # failure instead of a silent empty RunResult.
            if response is None:
                raise AgentError(
                    "Server closed the response stream without a completion event",
                )

            # Hook: on_llm_response
            if response:
                await dispatch_hook(hooks, "on_llm_response", {
                    "agent": config.name,
                    "iteration": iteration,
                    "response": response,
                })

            # Track usage
            if response:
                _add_usage(usage, response.get("usage"))
                if response.get("id"):
                    response_id = response["id"]

                # Extract reasoning from non-streaming response output
                reasoning = extract_reasoning(response.get("output", []))
                if reasoning:
                    accumulate_reasoning(all_reasoning, reasoning)

            # Check for server error in response
            if response and response.get("error"):
                err_msg = response["error"].get("message", "unknown")
                if config.retry:
                    err = AgentError(f"Server error: {err_msg}")
                    await dispatch_hook(hooks, "on_error", {
                        "agent": config.name,
                        "iteration": iteration,
                        "error": err,
                        "will_retry": False,
                    })
                    items.append(_error_to_item(err_msg))
                    continue
                raise AgentError(f"Server error: {err_msg}")

            # No function calls → done
            if not function_calls:
                output_text = _extract_text(response.get("output", [])) if response else None
                output = _parse_output(output_text, config.output_schema)

                meta = RunMeta(
                    usage=_usage_to_aggregated(usage),
                    iterations=iteration,
                    tool_calls=all_tool_calls,
                    response_id=response_id,
                    reasoning=all_reasoning if all_reasoning else None,
                )

                await dispatch_hook(hooks, "on_iteration_end", {
                    "agent": config.name,
                    "iteration": iteration,
                    "usage": _usage_to_aggregated(usage),
                })
                yield IterationEndEvent(iteration=iteration, usage=_usage_to_aggregated(usage))

                result_meta = meta
                await dispatch_hook(hooks, "on_agent_end", {
                    "agent": config.name,
                    "result": RunResult(output=output, meta=result_meta),
                })
                yield ResultEvent(output=output, meta=result_meta)
                return

            # Execute tools for retry path (non-retry path already ran them eagerly)
            if not tool_records and function_calls:
                tool_records = await _execute_tools_with_hooks(
                    config.tools,
                    function_calls,
                    config.parallel_tool_execution,
                    hooks,
                    config.name,
                    iteration,
                )
                for record in tool_records:
                    yield ToolStartEvent(
                        name=record.name,
                        call_id=record.call_id,
                        input=record.input,
                    )
                    yield ToolEndEvent(
                        name=record.name,
                        call_id=record.call_id,
                        output=record.output,
                        error=record.error,
                        duration_ms=record.duration_ms,
                    )

            all_tool_calls.extend(tool_records)
            _append_tool_results(items, function_calls, tool_records)
            last_iteration_called_tools = True

            await dispatch_hook(hooks, "on_iteration_end", {
                "agent": config.name,
                "iteration": iteration,
                "usage": _usage_to_aggregated(usage),
            })
            yield IterationEndEvent(iteration=iteration, usage=_usage_to_aggregated(usage))

        # Max iterations exhausted
        if config.on_max_iterations == "return_partial":
            meta = RunMeta(
                usage=_usage_to_aggregated(usage),
                iterations=max_iterations + 1,
                tool_calls=all_tool_calls,
                response_id=response_id,
                reasoning=all_reasoning if all_reasoning else None,
            )
            await dispatch_hook(hooks, "on_agent_end", {
                "agent": config.name,
                "result": RunResult(output=None, meta=meta),
            })
            yield ResultEvent(output=None, meta=meta)
            return

        raise MaxIterationsError(max_iterations, None, all_tool_calls)

    except BaseException as err:
        await dispatch_hook(hooks, "on_agent_end", {
            "agent": config.name,
            "error": err,
        })
        raise


# =============================================================================
# Helpers for buffered stream consumption (retry path)
# =============================================================================


async def _buffer_stream(
    client: Any,
    request: dict[str, Any],
    options: RequestOptions | None,
) -> dict[str, Any]:
    """Consume a stream fully, buffering all events. Used in retry path."""
    sse_stream = await client.create_stream_async(request, options)
    events: list[AgentStreamEvent] = []
    response: dict[str, Any] | None = None
    function_calls: list[dict[str, Any]] = []
    reasoning_text: str | None = None

    consumer = _consume_stream(sse_stream)
    async for event in consumer:
        if isinstance(event, dict) and event.get("_stream_done"):
            response = event.get("response")
            function_calls = event.get("function_calls", [])
            reasoning_text = event.get("reasoning_text")
        elif isinstance(event, dict) and event.get("_tool_ready"):
            # In retry path, we don't eagerly execute — just note the tool call
            pass
        else:
            events.append(event)  # type: ignore[arg-type]

    return {
        "events": events,
        "response": response,
        "function_calls": function_calls,
        "reasoning_text": reasoning_text,
    }


def _item_to_dict(item: Any) -> dict[str, Any]:
    """Convert an ORInputItem (dataclass or dict) to a plain dict."""
    if isinstance(item, dict):
        return item
    if hasattr(item, "to_dict"):
        return item.to_dict()
    raise TypeError(f"Cannot convert {type(item)} to dict")
