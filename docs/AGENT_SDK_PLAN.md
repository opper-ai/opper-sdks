# Agent SDK — Implementation Plan (TypeScript)

## Context

The Opper SDK has a complete base client layer. We're now building the **agent layer** — the higher-level abstraction for agents, tools, and the agentic loop. The agent layer uses Opper's **OpenResponses endpoint** (`POST /v3/compat/openresponses`) following the [Open Responses spec](https://www.openresponses.org).

**Key architectural decision:** The SDK maintains the full items array client-side in OpenResponses format. Each loop iteration sends the complete items history. Opper handles converting to provider-native formats. No `previous_response_id` dependency for the loop itself (though it may be used for conversation features later).

---

## Architecture Overview

### Wire Format: OpenResponses Items (not chat messages)

Instead of the old `{ role, content }` chat messages with `/call` and `/stream`, the agent layer uses **OpenResponses items** with a single endpoint:

| Concept | OpenResponses Format |
|---|---|
| User input | `{ type: "message", role: "user", content: "..." }` |
| System instructions | Top-level `instructions` field |
| Tool definitions | `tools: [{ type: "function", name, description, parameters }]` |
| Tool call (from model) | Output item: `{ type: "function_call", call_id, name, arguments }` |
| Tool result (to model) | Input item: `{ type: "function_call_output", call_id, output }` |
| Assistant text | Output item: `{ type: "message", role: "assistant", content: [{type: "output_text", text}] }` |
| Structured output | `text: { format: { type: "json_schema", name, schema } }` |

### The Agentic Loop

```
agent.run(input) / agent.stream(input):

1. Setup: resolve ToolProviders (MCP), convert tool schemas
2. Build initial items: [{ type: "message", role: "user", content: input }]
3. Hook: onAgentStart

LOOP (iteration = 1..maxIterations):
  4. Hooks: onIterationStart, onLLMCall

  5. POST /v3/compat/openresponses
     Body: {
       input: items,                    // full accumulated items array
       instructions: agent.instructions,
       model: agent.model,
       tools: [...],
       temperature, max_output_tokens,
       stream: false|true,
       text: outputSchema ? { format: {...} } : undefined,
       reasoning: reasoningEffort ? { effort } : undefined,
     }

  6. Parse response, extract output items
     Hook: onLLMResponse

  7. Append ALL output items to items array

  8. Extract function_call items from output
     If NONE → DONE → validate output → Hook: onAgentEnd → return

  9. Execute tools locally (parallel by default):
     For each function_call:
       - Hook: onToolStart
       - Find tool, JSON.parse(arguments), execute
       - Hook: onToolEnd
       - On error: serialize as result string

  10. Append function_call_output items to items array

  11. Hook: onIterationEnd → continue loop

12. maxIterations reached → throw MaxIterationsError
13. Teardown: ToolProvider cleanup
```

### Streaming

For `stream()`, SSE events from OpenResponses:
- `response.output_text.delta` → yield `{ type: "text_delta", text }`
- `response.function_call_arguments.delta` → accumulate internally
- `response.function_call_arguments.done` → complete tool call
- `response.completed` → full response available, extract items
- SDK generates `tool_start` / `tool_end` / `iteration_start` / `iteration_end` events around local execution

---

## File Structure

```
typescript/src/
  agent/
    index.ts          # Agent class + tool() + public exports
    types.ts          # All agent + OpenResponses wire types
    loop.ts           # runLoop() + streamLoop()
    stream.ts         # AgentStream class
    hooks.ts          # Hook dispatch
    errors.ts         # MaxIterationsError, AbortError, AgentError
    conversation.ts   # Conversation helper
    mcp/
      index.ts        # MCP tool provider
  clients/
    openresponses.ts  # OpenResponsesClient (base HTTP client)
  index.ts            # MODIFIED: add agent exports + opper.agent()
```

---

## Implementation Phases

### Phase 1: Foundation — Types + OpenResponses Client
- [x] Define all OpenResponses wire types: `ORRequest`, `ORResponse`, `OROutputItem`, `ORInputItem`, `ORTool`, `ORUsage`, `ORStreamEvent`
- [x] Define agent-layer types: `AgentConfig`, `AgentTool`, `RunResult`, `RunOptions`
- [x] Implement `OpenResponsesClient` extending `BaseClient`
- [x] Tests: mock fetch, verify request serialization, response parsing, SSE event parsing (17 tests passing)

**Files:** `agent/types.ts`, `clients/openresponses.ts`
**Tests:** `__tests__/openresponses-client.test.ts`
**Verify:** `npm test -- openresponses-client`

---

### Phase 2: Tool System
- [x] `tool()` factory function
- [x] Standard Schema support for `parameters` (reuse existing `resolveSchema`)
- [x] Tool → ORTool conversion (strip `execute`, add `type: "function"`)
- [x] Tests: definition, schema resolution, execution, error handling (12 tests passing)

**Files:** `agent/index.ts` (tool function), `agent/types.ts` (ToolConfig)
**Tests:** `__tests__/agent-tools.test.ts`
**Verify:** `npm test -- agent-tools`

---

### Phase 3: Core Loop — Non-Streaming (`run()`)
- [x] `runLoop()` function — the full loop logic
- [x] `Agent` class with `run()` method
- [x] Error classes: `MaxIterationsError`, `AgentError`, `AbortError`
- [x] `AbortSignal` support
- [x] Tests: no tools, single tool round-trip, multi-tool parallel, multi-iteration, max iterations error, structured output, abort (18 tests passing)

**Files:** `agent/loop.ts`, `agent/index.ts` (Agent class), `agent/errors.ts`
**Tests:** `__tests__/agent-run.test.ts`
**Verify:** `npm test -- agent-run`

---

### Phase 4: Streaming (`stream()`)
- [x] Define `AgentStreamEvent` discriminated union (7 event types)
- [x] `streamLoop()` function — same loop but with `stream: true`
- [x] `AgentStream` class with `[Symbol.asyncIterator]()` and `.result()`
- [x] `Agent.stream()` method
- [x] Tests: text deltas, tool call accumulation, full cycle, `stream.result()`, multi-iteration, sequential execution, error handling, structured output (11 tests passing)

**Files:** `agent/loop.ts` (streamLoop), `agent/stream.ts`, `agent/types.ts`
**Tests:** `__tests__/agent-stream.test.ts`
**Verify:** `npm test -- agent-stream`

---

### Phase 5: Hooks & Observability
- [x] Define `Hooks` interface and 8 hook context types
- [x] Hook dispatch helper (`dispatchHook` — safe async, error-swallowing)
- [x] Wire hooks into `runLoop()` and `streamLoop()`
- [x] Tests: hook call order, async hooks, sync hooks, error swallowing, context data, partial hooks, streaming hooks (11 tests passing)

**Files:** `agent/hooks.ts`, `agent/types.ts`, updates to `agent/loop.ts`
**Tests:** `__tests__/agent-hooks.test.ts`
**Verify:** `npm test -- agent-hooks`

---

### Phase 6: Multi-Agent Composition
- [x] `agent.asTool(name, description)` — wraps agent as a tool
- [x] Usage aggregation: sub-agent result includes output, usage, iterations, toolCalls
- [x] Tests: asTool creates valid tool, parent-child delegation, usage in output, error handling, hooks on both agents (6 tests passing)
- [ ] Trace propagation: parent span ID flows to sub-agent (deferred — can be added via hooks)

**Files:** `agent/index.ts` (asTool method)
**Tests:** `__tests__/agent-multi.test.ts`
**Verify:** `npm test -- agent-multi`

---

### Phase 7: Conversation / Multi-Turn
- [ ] Direct items input — pass items array to `run()`
- [ ] `Conversation` helper with `.send()` tracking items across turns
- [ ] Tests: multi-turn with context retention, tool calls within conversation turns

**Files:** `agent/conversation.ts`, updates to `agent/index.ts`
**Tests:** `__tests__/agent-conversation.test.ts`
**Verify:** `npm test -- agent-conversation`

---

### Phase 8: MCP Tool Providers
- [ ] `mcp()` factory function
- [ ] `ToolProvider` interface: `setup()` → `AgentTool[]`, `teardown()`
- [ ] Stdio transport (spawn subprocess, JSON-RPC over stdin/stdout)
- [ ] Tool name prefixing: `mcp__<server>__<toolname>`
- [ ] Tests: mock MCP server, tool discovery, execution

**Files:** `agent/mcp/index.ts`
**Tests:** `__tests__/agent-mcp.test.ts`
**Verify:** `npm test -- agent-mcp`

---

### Phase 9: Wire into Opper Class + Exports
- [ ] Add `opper.agent(config)` factory method on `Opper` class
- [ ] Export all agent types from `index.ts`
- [ ] Standalone `Agent` usage (reads `OPPER_API_KEY` from env)
- [ ] Integration test with live API (skipped without key)

**Files:** `index.ts`
**Tests:** existing tests still pass + integration test
**Verify:** `npm test`, `npm run lint`, `tsc --noEmit`

---

### Phase 10: Opper Observability — Traces & Spans for Agents
**Goal:** Agent runs appear as structured traces in Opper's observability dashboard.

**Key discovery:** The `/v3/compat/openresponses` endpoint accepts tracing headers (from OpenAPI spec):
- `X-Opper-Parent-Span-Id` — parent span ID for distributed tracing context
- `X-Opper-Name` — function name for tracing and routing

The server handles span creation automatically when these headers are present. This means the agent SDK just needs to:

1. Create a parent span for the agent execution at run start
2. Pass `X-Opper-Parent-Span-Id` on each LLM call so the server links them as children
3. Create child spans for local tool executions (these don't go through the API)
4. Close/update spans at the end

**Two-layer approach:**
- **LLM calls** → server-side tracing via `X-Opper-Parent-Span-Id` header (automatic)
- **Tool calls + agent lifecycle** → client-side spans via `SpansClient` (queued, flushed in finally)
- **Sub-agents** → nested execution span with `parentId` linking to parent tool span

**Implementation via hooks:** `createTracingHooks(spansClient)` factory returns a `Hooks` object. The loop passes headers through `RequestOptions`. Zero changes to the loop itself.

- [ ] Pass `X-Opper-Parent-Span-Id` and `X-Opper-Name` headers on LLM calls via `onLLMCall` hook or loop config
- [ ] Parent execution span created on `onAgentStart`, closed on `onAgentEnd`
- [ ] Tool spans as children via `SpansClient` (`onToolStart` / `onToolEnd`)
- [ ] Queued span updates flushed via `Promise.allSettled()` in `onAgentEnd`
- [ ] Sub-agent trace propagation — `asTool` passes parent span ID to child agent
- [ ] `opper.agent(config)` auto-injects tracing hooks

**Key reuse:**
- `SpansClient` (`clients/spans.ts`) — span CRUD for tool + agent lifecycle spans
- `getTraceContext()` / `runWithTraceContext()` (`context.ts`) — ALS propagation for sub-agents
- `RequestOptions.headers` — already supported by `OpenResponsesClient` for passing trace headers
- `Hooks` interface (Phase 5) — zero changes to the loop

**Files:** `agent/tracing.ts` (new), updates to `index.ts` for `opper.agent()`
**Tests:** `__tests__/agent-tracing.test.ts`
**Verify:** `npm test`, live test showing traces in Opper dashboard

---

## Spec Update

- [x] Update `typescript/SPEC.md` — OpenResponses architecture throughout
- [x] Update `CAPABILITIES.md` — Language-agnostic spec alignment

---

## Key Files to Modify/Create

| File | Action | Purpose |
|---|---|---|
| `typescript/src/agent/types.ts` | Create | All type definitions |
| `typescript/src/agent/index.ts` | Create | Agent class + tool() |
| `typescript/src/agent/loop.ts` | Create | Core agentic loop |
| `typescript/src/agent/stream.ts` | Create | AgentStream class |
| `typescript/src/agent/hooks.ts` | Create | Hook dispatch |
| `typescript/src/agent/errors.ts` | Create | Error classes |
| `typescript/src/agent/conversation.ts` | Create | Conversation helper |
| `typescript/src/agent/mcp/index.ts` | Create | MCP tool provider |
| `typescript/src/clients/openresponses.ts` | Create | HTTP client for OR endpoint |
| `typescript/src/index.ts` | Update | Add agent exports + factory |
| `typescript/src/client-base.ts` | May update | SSE parsing for named events |

## Reuse

- `BaseClient` (`client-base.ts`) — extend for OpenResponsesClient, reuse SSE parsing
- `resolveSchema()` / `toJsonSchema()` (`schema.ts`) — reuse for tool parameters
- `getTraceContext()` (`context.ts`) — reuse for trace propagation
- Error handling patterns from existing typed errors (`types.ts`)

---

## Future Enhancements (Post-Core Phases)

These are patterns identified from studying production agentic systems (see [AGENT_SDK_PATTERNS.md](./AGENT_SDK_PATTERNS.md)). They are not part of the core implementation phases but are worth adding once the foundation is solid. All are opt-in — the SDK should not enforce these on users.

### Tool Safety Metadata
- Optional `isReadOnly`, `isDestructive`, `isConcurrencySafe` properties on tools
- Runtime can use these for smarter parallel execution and permission decisions
- No change to existing tools — metadata is purely additive

### Error Recovery Loop
- Structured recovery in `runLoop()` / `streamLoop()`: context too long → auto-compact → retry; max output tokens → yield partial → continue
- Feed errors back to model as information instead of crashing the loop
- Keeps long-running agents resilient

### Deferred / Lazy Tool Loading
- For agents with many tools (especially MCP), avoid bloating the prompt with all schemas
- Lightweight tool index shown initially, full schemas loaded on demand
- Relevant when MCP tool providers have large catalogs

### Multi-Layer Permission System
- Pipeline of checks before tool execution: config rules → hooks → user prompt
- Each layer can allow, deny, or defer to the next
- SDK provides the pipeline; users define policies — important for enterprise

### Session Persistence / Resumability
- Serialize items array + tool call history to disk or external store
- Resume long-running agent sessions after process restarts
- SDK provides serialization helpers; storage backends are pluggable

### Extended Composition Patterns
- **Coordinator**: leader agent dispatches to specialists via message-passing
- **Async background**: spawn sub-agents that run independently, notify on completion
- Beyond `asTool()` — generalizable primitives users compose for their architecture
