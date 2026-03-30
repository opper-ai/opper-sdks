# Opper TypeScript SDK — Development Plan

> Living document tracking progress. Updated as work completes.

## Base Client Phase

### Phase 0: Project Setup
- [x] Create `PLAN.md` (this file)
- [x] Add `vitest` test framework
- [x] Add `biome` for linting + formatting
- [x] Update `package.json` with scripts: `test`, `lint`, `format`, `check`, `examples`
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

### Phase 3: Missing Endpoints + Cleanup
- [x] Add `SpansClient` with `create()` (POST) and `update()` (PATCH)
- [x] Add examples methods: `createExample`, `createExamplesBatch`, `listExamples`, `deleteExample`
- [x] Wire `SpansClient` into `Opper` as `client.spans`
- [x] Keep `EmbeddingsClient` as `client.embeddings`
- [x] Remove compat clients (chat, responses, interactions, messages) — not in SDK surface
- [x] Remove parse client
- [x] Tests for all remaining clients

### Phase 4: Examples + Runner
- [x] Write getting-started examples (00-08)
- [x] Create `examples/run-all.ts` runner script
- [x] Add `npm run examples` script
- [x] Package renamed to `opperai`

## Verification Checklist
- [x] `npm run lint` — no errors
- [x] `npm test` — all unit tests pass
- [x] `tsc --noEmit` — compiles cleanly
- [x] Every endpoint has a method (verified by coverage.test.ts)
- [x] `StreamChunk` SSE parsing handles all 5 chunk types
- [x] README documents all methods
- [x] PLAN.md reflects current status
- [ ] `npm run examples` — all examples pass against live API

---

## Next: Agent Layer Phase

_To be planned after base client is stable._
