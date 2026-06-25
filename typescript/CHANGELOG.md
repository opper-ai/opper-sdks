# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.1.1] - 2026-06-25

### Fixed

- **Agent structured output no longer silently lost.** When an `outputSchema`
  is set but the model returns nothing usable, the loop raised no error: a
  reasoning-only response became `output: undefined` and truncated/invalid
  JSON was returned as a raw string. Both cases now throw `AgentError` with
  diagnostics — response `status`, `incomplete_details`, `output_tokens` vs
  `max_output_tokens`, a truncation hint, and a snippet of the raw output.
  Applies to both the native and `final_answer` fallback paths.
- **`structuredOutputMode: "tool"` now works for tool-less agents.** The mode
  check runs before the `hasTools` guard, so forcing the tool fallback is
  honored even when no tools are configured (previously a silent no-op that
  contradicted the documented contract).
- **`extractText` no longer drops content.** It concatenates every
  `output_text` part across all assistant message items instead of returning
  only the first — fixes truncated answers from models that split output
  across parts.
- **Tolerant structured-output parsing.** Output wrapped in ` ```json `
  fences or preceded by a sentence is now recovered before the loop gives up.

### Changed

- **Default `max_output_tokens` is now 16000** for agent LLM calls when the
  caller sets none, replacing the small provider default (~4096) that could
  truncate reasoning models mid-answer. 16k stays within most models' output
  limits; for a model that caps output lower, set `maxTokens` on the agent or
  per-run options to match it.

## [4.1.0] - 2026-05-27

### Added

- Synthetic `final_answer` tool fallback for the agent loop when a model
  can't accept JSON-schema response format + tools in one request
  (Moonshot, Fireworks GLM, Gemini 1.x, etc.). A capability lookup picks
  the path; structured output is delivered via a tool call the loop
  treats as terminal. Surfaces as a `final_answer` record in
  `result.meta.toolCalls`, fires `onToolStart`/`onToolEnd` hooks, emits
  `tool_start`/`tool_end` stream events, and stitches a `final_answer`
  span (tagged `final_answer: true`) under the agent root.
- `new Agent({ structuredOutputMode: "auto" | "native" | "tool" })` and
  matching per-call override on `RunOptions` to force a path.
- `examples/agents/12-agent-with-tools-and-schema.ts` — exercises the
  combo end-to-end. Flip the `model` line to a non-whitelisted model
  (e.g. `fireworks/glm-5.1`) to see the fallback in action.
- `examples/agents/applied_agents/datadog-error-summary-agent.ts`:
  multi-step agent that wires the official Datadog hosted MCP server with
  env-var auth headers and produces a structured 2-hour error report.

### Changed

- Rewrote `examples/agents/applied_agents/daily-digest-agent.ts` around
  three direct-API `tool({ ... })` functions (Hacker News, Jina search,
  Notion REST), removing the previous Composio MCP integration that
  proved unreliable for headless runs.

## [4.0.1] - 2026-05-21

### Changed

- Refreshed npm package keywords for better discoverability (added `ai`,
  `ai-agents`, `tool-use`, `structured-output`, `json-schema`, `zod`,
  `streaming`, `mcp`, `rag`, `knowledge-base`, `gateway`, `control-plane`,
  `zdr`, `zero-data-retention`, `observability`; removed stale `starlark`,
  `task-api`, `sdk`).

## [4.0.0] - 2026-05-20

First stable release of the 4.0 line. Built for Opper API v3.

### Changed

- **Breaking:** The 4.0 line is a single unified `opperai` package that
  replaces both `opperai` 3.x and `@opperai/agents` 0.x. See
  [`MIGRATION.md`](./MIGRATION.md) or the hosted
  [migration guide](https://docs.opper.ai/agents/migration) for a complete
  list of breaking changes and side-by-side old → new examples.
- **Breaking:** Simplified client method names to match Python SDK
  conventions (`models.list()`, `functions.list/get/delete/run/stream`,
  `knowledge.delete()`), and list methods now return arrays directly
  (`ModelInfo[]`, `FunctionInfo[]`, …) instead of wrapper objects.
- **Breaking:** Zod peer dependency narrowed to `^4.0.0` (Zod v3 dropped —
  it never worked with `toJSONSchema`).
- npm `latest` dist-tag — no longer published under the `beta` tag.

### Highlights since 3.x

- **Agent SDK** built into `opperai` — `Agent` with `run()` / `stream()` /
  `conversation()`, `tool(...)` factory, lifecycle `hooks`, structured
  output, multi-agent composition, MCP tool providers, OpenResponses
  client, streaming agent loop with eager tool execution, and tracing.
- **Realtime** — `opper.realtime` client for the model-driven
  `/v3/realtime` WebSocket endpoint, including
  `opper.realtime.createSession()` to mint ephemeral tickets for
  browser-direct access.
- **Reasoning** — `reasoning_effort` (`"low" | "medium" | "high"`) and
  `reasoning_summary` on `RunRequest` / `SchemaRunRequest` /
  `AgentConfig` / `RunOptions` (camelCase on agent surface).
- **Models** — `ModelConfig` and `Model` types accept a string, a config
  object with provider-specific `options`, or a fallback array.
- **Beta endpoints** — `@beta` JSDoc convention on endpoints marked
  `x-beta: true` in the OpenAPI spec; beta endpoints exposed under the
  `opper.beta.*` namespace (e.g. `opper.beta.web.search`).
- **Artifacts** — `PendingOperation` / `ArtifactStatus` types,
  `ArtifactsClient.getStatus()`, and `generateVideo()` auto-polls.
- **Spans** — `CreateSpanRequest.start_time` / `end_time` and
  `UpdateSpanRequest.end_time` accept `Date` in addition to `string`.
- **Errors** — typed error subclasses (`AuthenticationError`,
  `RateLimitError`, …) raised consistently across streaming and
  non-streaming paths; `4xx` (except `408` / `429`) are fatal in the
  agent loop instead of being silently retried.
- **Zod v4 hardening** — strip auto-added integer safe-bounds from
  `z.number().int()` so output schemas don't 400 against strict
  providers; user-specified bounds preserved.

See the `4.0.0-beta.0` … `4.0.0-beta.16` entries below for the full
per-pre-release history.

## [4.0.0-beta.16] - 2026-05-20

### Changed

- Fix publish runtime.

## [4.0.0-beta.14] - 2026-05-19

### Added

- `opper.realtime` client for the model-driven `/v3/realtime` WebSocket
  endpoint:
  - `opper.realtime.url({ ticket? })` — build the WebSocket URL,
    optionally appending a ticket query parameter for clients that can't
    set subprotocols.
  - `opper.realtime.createSession({ config, locked_fields?, ttl_seconds? })`
    — POST `/v3/realtime-sessions` to mint a single-use ephemeral ticket
    for browser-direct WebSocket access. The returned `client_secret` is
    what the browser carries in the `Sec-WebSocket-Protocol:
    opper-ticket.<secret>` subprotocol header.
- Types: `RealtimeSession`, `RealtimeSessionConfig`,
  `CreateRealtimeSessionRequest`, `RealtimeTool`, `RealtimeTurnDetection`,
  plus a `RealtimeClient` export.

### Removed

- **Breaking:** `opper.functions.createRealtime()`,
  `opper.functions.getRealtimeWebSocketUrl()`, and the
  `CreateRealtimeFunctionRequest` / `RealtimeCreateRequest` /
  `RealtimeCreateResponse` types. The legacy `/v3/functions/{name}/realtime`
  create-then-connect flow is superseded by the model-driven `/v3/realtime`
  endpoint with inline `config` (server-side) or pre-bound config on an
  ephemeral ticket (browser-side). Use `opper.realtime.url()` and
  `opper.realtime.createSession()` instead.

## [4.0.0-beta.13] - 2026-05-19

### Added

- `reasoning_effort` and `reasoning_summary` on `RunRequest` / `SchemaRunRequest`,
  wired through `Opper.call()` / `stream()` and the underlying wire mapping.
  `reasoning_effort` is now typed as `"low" | "medium" | "high"` (previously
  loosely `string`); `reasoning_summary` opts into thought summary streaming.
  Both fields are also accepted on `AgentConfig` and `RunOptions` as
  `reasoningEffort` / `reasoningSummary`.
- `ResponseMeta.tool_calls` — per-call tool invocation records surfaced by
  the server on the response metadata.
- `ModelInfo.family`, `ModelInfo.max_output_tokens`, `ModelInfo.thinking`
  to match the v3 model catalogue schema.
- `ORResponse.parallel_tool_calls`, `ORResponse.previous_response_id`,
  and `ORUsage.cost` on the OpenResponses wire types.

### Changed

- `reasoning_effort` on `RunRequest` and `SchemaRunRequest` is now typed
  as `"low" | "medium" | "high"` instead of the looser `string`. Callers
  passing a literal "low" / "medium" / "high" are unaffected; anything else
  was already a server-side error.

## [4.0.0-beta.12] - 2026-04-30

### Changed

- `Agent.run()` now drains the streaming loop internally — one agent loop instead of two — matching the Python SDK; tools execute eagerly during the stream so `onToolStart` / `onToolEnd` fire before `onLLMResponse`, and `OpenResponsesClient.createStream` errors now map to typed subclasses (`AuthenticationError`, `RateLimitError`, etc.) like `create`.

## [4.0.0-beta.11] - 2026-04-22

### Fixed

- Agent surfaces a clear error when the response stream closes without a
  completion event, instead of returning a silent empty result.
- `4xx` API errors (except `408` and `429`) are now treated as fatal by the
  agent loop — they surface immediately on the first iteration instead of
  being converted to in-context recovery turns until max-iterations.

## [4.0.0-beta.10] - 2026-04-20

### Changed

- `CreateSpanRequest.start_time` / `end_time` and `UpdateSpanRequest.end_time`
  now accept `Date` in addition to `string`. `JSON.stringify` serialises `Date`
  to an ISO-8601 string natively, so the wire format is unchanged — callers no
  longer need to call `.toISOString()` manually.

## [4.0.0-beta.9] - 2026-04-20

### Fixed

- `parentSpanId` option on `agent.run()` / `agent.stream()` is now honoured
  (previously declared on `RunOptions` but never read). When provided
  explicitly it takes precedence over the ambient trace context — the server
  assigns `trace_id`, avoiding the mismatched pair that would result from
  merging an explicit parent with ambient `traceId`.

### Changed

- `model` on `AgentConfig`, `RunOptions`, and the `ORRequest` wire type now
  accepts the full `Model` type — a string, a `ModelConfig` object with
  provider-specific `options`, or a fallback array — matching
  `RunRequest.model` used by `opper.call`.

## [4.0.0-beta.8] - 2026-04-17

### Changed

- Web tools (`opper.beta.web.fetch`, `opper.beta.web.search`) now call the stable paths `/v3/tools/web/{fetch,search}` (the `/v3/beta/*` paths still redirect server-side). The endpoints remain marked `x-beta: true` in the OpenAPI spec and are still exposed under `opper.beta.*`.

### Added

- `@beta` JSDoc convention on beta endpoints — class-level and method-level. IDE tooling surfaces the tag on hover.

## [4.0.0-beta.7] - 2026-04-10

### Added

- `ModelConfig` and `Model` types — `model` field on `RunRequest` and `SchemaRunRequest` now accepts a string, a `ModelConfig` object with provider-specific `options`, or a fallback chain (array)

### Fixed

- `ORContentPart.text` is now required, matching the API spec

## [4.0.0-beta.6] - 2026-04-09

### Added

- Agent layer with agentic loop, tool use, structured output, streaming, hooks, multi-agent composition, MCP tool providers, conversation/multi-turn support, tracing & observability, error recovery, reasoning extraction, eager tool execution, and turn awareness
- OpenResponses client for the Opper responses API
- 12 agent examples covering all features

### Fixed

- Lint warnings (replaced non-null assertions with type-safe casts)

## [4.0.0-beta.5] - 2026-04-02

### Fixed

- Strip Zod v4 auto-added safe-integer bounds (`minimum`/`maximum`) from `z.number().int()` in JSON Schema output. These bounds caused 400 errors with APIs that reject min/max on integer types (e.g. Anthropic output schemas). User-specified bounds are preserved.

## [4.0.0-beta.4] - 2026-04-01

### Added

- `aliases` field on `ModelInfo` type to match updated API spec

## [4.0.0-beta.3] - 2026-03-31

### Changed

- **Breaking:** Simplified client method names to match Python SDK conventions
  - `models.listModels()` → `models.list()`
  - `functions.listFunctions()` / `getFunction()` / `deleteFunction()` / `runFunction()` / `streamFunction()` → `list()` / `get()` / `delete()` / `run()` / `stream()`
  - `functions.createRealtimeFunction()` → `functions.createRealtime()`
  - `knowledge.deleteKnowledgeBase()` → `knowledge.delete()`
- **Breaking:** List methods now return arrays directly instead of wrapper objects
  - `models.list()` returns `ModelInfo[]` (was `{ models: ModelInfo[] }`)
  - `functions.list()` returns `FunctionInfo[]` (was `{ functions: FunctionInfo[] }`)
  - `functions.listRevisions()` returns `RevisionInfo[]` (was `{ revisions: RevisionInfo[] }`)
  - `functions.listExamples()` returns `Example[]` (was `{ examples: Example[] }`)
- **Breaking:** Zod peer dependency narrowed to `^4.0.0` (dropped v3 support — v3 never worked with `toJSONSchema`)
- Removed `ModelsResponse`, `ListFunctionsResponse`, `ListRevisionsResponse`, `ListExamplesResponse` wrapper types from exports

### Added

- Zod v4 requirement note in README
- Runnable docs code snippets with setup/teardown markers and `run-all.ts` runner

## [4.0.0-beta.2] - 2026-03-31

### Added

- `PendingOperation` and `ArtifactStatus` types for async artifact generation
- `pending_operations` and `status` fields on `ResponseMeta`
- `ArtifactsClient` with `getStatus()` for polling artifact generation status
- `generateVideo()` now auto-polls pending operations and downloads the result

## [4.0.0-beta.0] - 2026-03-30

### Changed

- New major version built for Opper API v3

[4.1.1]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.1.1
[4.1.0]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.1.0
[4.0.1]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.1
[4.0.0]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0
[4.0.0-beta.16]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.16
[4.0.0-beta.14]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.14
[4.0.0-beta.13]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.13
[4.0.0-beta.12]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.12
[4.0.0-beta.11]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.11
[4.0.0-beta.10]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.10
[4.0.0-beta.9]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.9
[4.0.0-beta.8]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.8
[4.0.0-beta.7]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.7
[4.0.0-beta.6]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.6
[4.0.0-beta.5]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.5
[4.0.0-beta.4]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.4
[4.0.0-beta.3]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.3
[4.0.0-beta.2]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.2
[4.0.0-beta.0]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.0
