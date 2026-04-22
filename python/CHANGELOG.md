# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
