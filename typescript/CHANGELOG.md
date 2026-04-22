# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
