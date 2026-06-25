# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.1] - 2026-06-25

### Fixed

- **Agent structured output no longer silently lost.** When an
  `output_schema` is set but the model returns nothing usable, the loop
  raised no error: a reasoning-only response became `output=None` and
  truncated/invalid JSON was returned as a raw string (later blowing up as a
  contextless `ValidationError`). Both cases now raise `AgentError` with
  diagnostics — response `status`, `incomplete_details`, `output_tokens` vs
  `max_output_tokens`, a truncation hint, and a snippet of the raw output.
  Applies to both the native and `final_answer` fallback paths.
- **`structured_output_mode="tool"` now works for tool-less agents.** The
  mode check runs before the `has_tools` guard, so forcing the tool fallback
  is honored even when `tools=[]` (previously a silent no-op that
  contradicted the documented contract).
- **`_extract_text` no longer drops content.** It concatenates every
  `output_text` part across all assistant message items instead of returning
  only the first — fixes truncated answers from models that split output
  across parts.
- **Tolerant structured-output parsing.** Output wrapped in ` ```json `
  fences or preceded by a sentence is now recovered before the loop gives up.

### Changed

- **Default `max_output_tokens` is now 16000** for agent LLM calls when the
  caller sets none, replacing the small provider default (~4096) that could
  truncate reasoning models mid-answer. 16k stays within most models' output
  limits; for a model that caps output lower, set `max_tokens` on the agent or
  per-run options to match it.

## [2.1.0] - 2026-05-27

### Added

- Synthetic `final_answer` tool fallback for the agent loop when a model
  can't accept JSON-schema response format + tools in one request
  (Moonshot, Fireworks GLM, Gemini 1.x, etc.). A capability lookup picks
  the path; structured output is delivered via a tool call the loop
  treats as terminal. Surfaces as a `final_answer` record in
  `result.meta.tool_calls`, fires `on_tool_start`/`on_tool_end` hooks,
  emits stream events, and stitches a `final_answer` span (tagged
  `final_answer: True`) under the agent root.
- `Agent(structured_output_mode="auto" | "native" | "tool")` and matching
  per-call override on `agent.run` / `agent.stream` to force a path.
- `examples/agents/12_agent_with_tools_and_schema.py` — exercises the
  combo end-to-end. Flip the `model` line to a non-whitelisted model
  (e.g. `fireworks/glm-5.1`) to see the fallback in action.
- `examples/agents/applied_agents/datadog_error_summary_agent.py`:
  multi-step agent that wires the official Datadog hosted MCP server with
  env-var auth headers and produces a structured 2-hour error report.

### Changed

- Rewrote `examples/agents/applied_agents/daily_digest_agent.py` around
  three direct-API `@tool` functions (Hacker News, Jina search, Notion
  REST), removing the previous Composio MCP integration that proved
  unreliable for headless runs.
- MCP teardown (`MCPClient.disconnect` and the agent's provider teardown
  loops) now tolerates `CancelledError` raised by anyio cancel-scope
  unwinding, so cleanup can't poison the caller's task with a stale
  cancellation.

## [2.0.2] - 2026-05-21

### Changed

- Added PyPI `keywords` and `classifiers` metadata for better discoverability
  on PyPI search and browse filters. Keywords mirror the TypeScript SDK
  (`ai`, `ai-agents`, `tool-use`, `structured-output`, `json-schema`,
  `pydantic`, `streaming`, `mcp`, `rag`, `knowledge-base`, `gateway`,
  `control-plane`, `zdr`, `zero-data-retention`, `observability`).

## [2.0.1] - 2026-05-21

### Fixed

- Nested Pydantic models in `output_schema` no longer break structured output.
  Pydantic's `model_json_schema()` emits nested models as `$ref` pointers into
  a top-level `$defs` dict; the SDK now inlines those refs before sending so
  the schema is self-contained. Without this, OpenAI strict mode returned 400
  (`"items section, the schema is missing a required 'type' key"`) and
  Anthropic / Vertex providers silently flattened nested objects into scalars,
  causing `model_validate` failures on the client. Supports both `$defs` and
  the legacy `definitions` keyword; self-referential schemas leave the cycle
  in place rather than infinite-loop.

## [2.0.0] - 2026-05-20

First stable release of the 2.0 line. Built for Opper API v3.

### Changed

- **Breaking:** The 2.0 line is a single unified `opperai` package that
  replaces both `opperai` 1.x and `opper-agents` 0.x. See
  [`MIGRATION.md`](./MIGRATION.md) or the hosted
  [migration guide](https://docs.opper.ai/agents/migration) for a complete
  list of breaking changes and side-by-side old → new examples.

### Highlights since 1.x

- **Agent SDK** built into `opperai` — `Agent` with `run()` / `stream()` /
  `conversation()`, `@tool` decorator, lifecycle `Hooks`, `RetryPolicy`,
  structured output via Pydantic / dataclasses / TypedDicts, multi-agent
  composition via `agent.as_tool()`, MCP tool providers (stdio / SSE /
  streamable-HTTP), and automatic tracing with parent + per-tool child spans.
- **Realtime** — `opper.realtime` client for the model-driven `/v3/realtime`
  WebSocket endpoint, including `create_session()` to mint ephemeral tickets
  for browser-direct access.
- **Reasoning** — `reasoning_effort` (`"low" | "medium" | "high"`) and
  `reasoning_summary` on `opper.call` / `stream` / `Agent` / `RunOptions`.
- **Models** — `ModelConfig` and `Model` types accept a string, a config dict
  with provider-specific `options`, or a fallback chain.
- **Beta endpoints** — `@beta` decorator emits a one-time `BetaWarning` for
  endpoints marked `x-beta: true` in the OpenAPI spec; beta endpoints exposed
  under the `opper.beta.*` namespace (e.g. `opper.beta.web.search`).
- **Artifacts** — `PendingOperation` / `ArtifactStatus` types, async
  `ArtifactsClient.get_status()`, and `generate_video()` auto-polls.
- **Spans** — `spans.create` / `update` accept `datetime` for `start_time` /
  `end_time` (naive datetimes assumed UTC).
- **Errors** — typed error hierarchy (`BadRequestError`, `NotFoundError`,
  `AuthenticationError`, `RateLimitError`, …) raised consistently across
  streaming and non-streaming paths; `4xx` (except `408` / `429`) are fatal
  in the agent loop instead of being silently retried.

See the `2.0.0b1` … `2.0.0b13` entries below for the full per-pre-release
history.

## [2.0.0b13] - 2026-05-19

### Added

- `opper.realtime` client for the model-driven `/v3/realtime` WebSocket
  endpoint:
  - `opper.realtime.url(ticket=None)` — build the WebSocket URL, optionally
    appending a ticket query parameter for clients that can't set
    subprotocols.
  - `opper.realtime.create_session(config=..., locked_fields=...,
    ttl_seconds=...)` (+ `create_session_async`) — POST
    `/v3/realtime-sessions` to mint a single-use ephemeral ticket for
    browser-direct WebSocket access. The returned `client_secret` is what
    the browser carries in the `Sec-WebSocket-Protocol: opper-ticket.<secret>`
    subprotocol header.
- `RealtimeSession`, `RealtimeTool`, `RealtimeTurnDetection` dataclasses
  in `opperai.types`.

### Removed

- **Breaking:** `opper.functions.create_realtime` /
  `create_realtime_async` / `get_realtime_ws_url` and the
  `RealtimeCreateResponse` dataclass. The legacy `/v3/functions/{name}/realtime`
  create-then-connect flow is superseded by the model-driven `/v3/realtime`
  endpoint with inline `config` (server-side) or pre-bound config on an
  ephemeral ticket (browser-side). Use `opper.realtime.url()` and
  `opper.realtime.create_session()` instead.

## [2.0.0b12] - 2026-05-19

### Added

- `reasoning_effort` and `reasoning_summary` kwargs on `opper.call()`,
  `opper.call_async()`, `opper.stream()`, and `opper.stream_async()`.
  `reasoning_effort` is typed as `Literal["low", "medium", "high"]`;
  `reasoning_summary` enables thought summary streaming (e.g. `"auto"`).
  Both fields are also accepted on `Agent` and `RunOptions`.
- `ResponseMeta.tool_calls` — per-call tool invocation records surfaced by
  the server on the response metadata.
- `ModelInfo.family`, `ModelInfo.max_output_tokens`, `ModelInfo.thinking`
  to match the v3 model catalogue schema.

## [2.0.0b11] - 2026-04-22

### Fixed

- Agent surfaces a clear error when the response stream closes without a
  completion event, instead of returning a silent empty result.
- HTTP error responses on streaming endpoints now raise the correct typed
  error (`BadRequestError`, `NotFoundError`, etc.) with the server's message,
  instead of leaking an `httpx.ResponseNotRead` exception.
- `4xx` API errors (except `408` and `429`) are now treated as fatal by the
  agent loop — they surface immediately on the first iteration instead of
  being converted to in-context recovery turns until max-iterations.

## [2.0.0b10] - 2026-04-20

### Changed

- `spans.create` / `spans.update` (and the `_async` variants) now accept
  `datetime` for `start_time` / `end_time` in addition to an ISO-8601 string.
  Naive datetimes are assumed to be UTC and serialised via `.isoformat()` —
  callers no longer need to stringify manually. The wire format is unchanged.

## [2.0.0b9] - 2026-04-20

### Fixed

- Agent tool results: tool outputs that are Pydantic models, dataclasses, or
  other non-JSON-native values are now correctly serialised into the
  `function_call_output.output` item the server replays on the next turn.
  `json.dumps` previously raised `TypeError` on these, which
  silently corrupted the agent loop state (the tool-result item never landed
  and the next iteration saw an incomplete history).
- Agent tracing: span `end_time` is now written when `output_schema` is a
  Pydantic model. The previous failure was silently swallowed by a bare
  `except BaseException`, so spans showed "N/A" duration in the trace UI.
- `parent_span_id` kwarg on `agent.run()` / `agent.stream()` is now honoured.
  When provided it takes precedence over the ambient trace context (matching
  the `opper.call` semantics in `_client.py`), so an explicit parent on a
  different trace can't inherit a mismatched `trace_id` from ambient.
- `Conversation` history serialisation now handles Pydantic / dataclass
  outputs via a shared `to_json_str` helper; assistant message `content`
  goes through `to_text` so raw strings are not double-quoted.
- `Agent.as_tool()` wrapper: the inner `execute` function now accepts
  `input=` as a keyword argument. Tool dispatch unpacks arguments via
  `execute(**parsed)`, so the previous positional `params` signature raised
  `TypeError: execute() got an unexpected keyword argument 'input'`,
  breaking every multi-agent composition.

### Changed

- `model` parameter on `Agent` and `RunOptions` now accepts the full `Model`
  type — a string, a `ModelConfig` dict with provider-specific `options`, or
  a list fallback chain — matching `opper.call()`.

## [2.0.0b8] - 2026-04-17

### Changed

- Web tools (`opper.beta.web.fetch`, `opper.beta.web.search`, plus async variants) now call the stable paths `/v3/tools/web/{fetch,search}` (the `/v3/beta/*` paths still redirect server-side). The endpoints remain marked `x-beta: true` in the OpenAPI spec and are still exposed under `opper.beta.*`.

### Added

- `@beta` decorator (`opperai._beta.beta`) applied to beta API methods. Emits a one-time `BetaWarning` (subclass of `FutureWarning`) on first call and prefixes the docstring with `[BETA]`. Suppress via standard `warnings.simplefilter("ignore", BetaWarning)`.

## [2.0.0b7] - 2026-04-14

### Added

- **Agent SDK** — build AI agents with tool use, streaming, structured output, and observability
- `Agent` class with `run()`, `stream()`, and `conversation()` for single-turn, streaming, and multi-turn interactions
- `@tool` decorator to define agent tools from plain Python functions (sync and async)
- `Hooks` for lifecycle events (agent start/end, iteration, tool calls, LLM calls, errors)
- `RetryPolicy` with exponential backoff for transient errors
- Structured output via Pydantic models, dataclasses, or TypedDicts
- Multi-agent composition via `agent.as_tool()` — use one agent as a tool for another
- MCP tool providers (`MCPStdioConfig`, `MCPSSEConfig`, `MCPStreamableHTTPConfig`) with lazy imports
- Automatic tracing with parent spans per `run()`/`stream()` and child spans per tool call
- `Opper.agent()` factory method for creating agents with inherited credentials
- 12 examples under `examples/agents/` including an applied daily digest agent

## [2.0.0b6] - 2026-04-10

### Added

- `ModelConfig` and `Model` types — `model` parameter now accepts a string, a `ModelConfig` dict with provider-specific `options`, or a fallback chain (list)

## [2.0.0b5] - 2026-04-01

### Changed

- Adjust schemas for forward compatibility

## [2.0.0b4] - 2026-04-01

### Added

- `aliases` field on `ModelInfo` type to match updated API spec

## [2.0.0b3] - 2026-03-31

### Added

- Runnable docs code snippets with setup/teardown markers and `run_all.py` runner

## [2.0.0b2] - 2026-03-31

### Added

- `PendingOperation` and `ArtifactStatus` types for async artifact generation
- `pending_operations` and `status` fields on `ResponseMeta`
- `ArtifactsClient` with `get_status()` for polling artifact generation status
- `generate_video()` now auto-polls pending operations and downloads the result

## [2.0.0b1] - 2026-03-30

### Changed

- New major version built for Opper API v3

[2.1.1]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.1.1
[2.1.0]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.1.0
[2.0.2]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.2
[2.0.1]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.1
[2.0.0]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0
[2.0.0b13]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b13
[2.0.0b12]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b12
[2.0.0b11]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b11
[2.0.0b10]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b10
[2.0.0b9]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b9
[2.0.0b8]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b8
[2.0.0b7]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b7
[2.0.0b6]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b6
[2.0.0b5]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b5
[2.0.0b4]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b4
[2.0.0b3]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b3
[2.0.0b2]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b2
[2.0.0b1]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b1
