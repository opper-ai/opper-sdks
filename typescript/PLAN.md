# Opper TypeScript SDK — Development Plan

> Living document tracking progress. Updated as work completes.

## Base Client Phase

### Phase 0: Project Setup
- [x] Create `PLAN.md` (this file)
- [x] Add `vitest` test framework
- [x] Add `biome` for linting + formatting
- [x] Update `package.json` with scripts: `test`, `lint`, `format`, `check`
- [x] Add `biome.json` config
- [x] Create first test: `client-base.test.ts`
- [x] Update `README.md`

### Phase 1: Types + Client Construction + Error Handling
- [x] Fix `RunRequest`: add `model`, `temperature`, `max_tokens`, `reasoning_effort`; remove `hints`
- [x] Add `StreamChunk` type
- [x] Fix `UsageInfo`: add `input_audio_tokens`, `output_audio_tokens`
- [x] Client construction: support `new Opper()` with env var fallback
- [x] Add `patch()` method to `BaseClient`
- [x] Rename `TaskApiClient` → `Opper`
- [x] Add top-level `run()` and `stream()` convenience methods
- [x] Tests: `client.test.ts`, `errors.test.ts`, `client-base.test.ts`

### Phase 2: Fix Core Execution Endpoints
- [x] Fix stream return type: `streamFunction` yields `StreamChunk` (not `RunResponse`)
- [x] Unit tests with mocked fetch for run and stream
- [x] SSE parsing tests for all 5 chunk types: content, tool_call_start, tool_call_delta, done, error
- [x] Integration test stub (skipped without `OPPER_API_KEY`)

### Phase 3: Fix Compat Clients + Missing Endpoints
- [x] Fix `ChatClient` path: `/v3/compat/chat/completions`
- [x] Fix `EmbeddingsClient` path: `/v3/compat/embeddings`
- [x] Fix `ResponsesClient` path: `/v3/compat/responses`
- [x] Fix `InteractionsClient` path: `/v3/compat/v1beta/interactions`
- [x] Fix Messages path: `/v3/compat/v1/messages`
- [x] Add `SpansClient` with `create()` (POST) and `update()` (PATCH)
- [x] Add examples methods: `createExample`, `createExamplesBatch`, `listExamples`, `deleteExample`
- [x] Wire `SpansClient` into `Opper` as `client.spans`
- [x] Separate `MessagesClient` from `InteractionsClient`
- [x] Tests for all compat clients verifying correct URL paths

### Phase 4: Namespace Restructure + Exports + Coverage
- [x] Group compat endpoints under `client.compat.*`
- [x] Clean up exports
- [x] Coverage test: verify every spec endpoint has a method
- [x] Exports test: verify public API surface
- [x] Update `README.md` with final API surface
- [x] Update `PLAN.md` — mark base client complete

## Verification Checklist
- [x] `npm run lint` — no errors
- [x] `npm test` — all unit tests pass (92 tests)
- [x] `tsc --noEmit` — compiles cleanly
- [x] Every endpoint in BASE_CLIENT_SPEC.md §3 has a method (verified by coverage.test.ts)
- [x] Every method has a unit test verifying URL path and request shape
- [x] `StreamChunk` SSE parsing handles all 5 chunk types
- [x] README documents all methods and namespaces
- [x] PLAN.md reflects current status

---

## Next: Agent Layer Phase

_To be planned after base client is stable._
