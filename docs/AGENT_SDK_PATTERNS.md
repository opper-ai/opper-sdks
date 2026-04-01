# Agent SDK — Key Patterns & Recommendations

Distilled from analyzing the Claude Code CLI architecture (a production-grade agentic system).

---

## 1. Tool System — The Foundation

The single most important abstraction: **everything the agent can do is a Tool**.

```typescript
type Tool<Input, Output, Progress> = {
  name: string
  inputSchema: ZodType<Input>        // Zod for validation
  call(args, context): Promise<ToolResult<Output>>
  description(input, options): string
  checkPermissions(input, context): Promise<PermissionResult>
  isReadOnly(input): boolean
  isDestructive(input): boolean
  isConcurrencySafe(input): boolean   // Can run in parallel?
  validateInput(input, context): Promise<ValidationResult>
}
```

**Key insight**: Tools declare their own safety properties (`isReadOnly`, `isDestructive`, `isConcurrencySafe`). This lets the runtime make smart decisions about parallelism and permissions without hardcoding policy.

**Recommendation**: Build the tool interface with self-describing safety metadata from day one.

---

## 2. Streaming-First Query Loop (Async Generator)

The core engine is an **async generator** that yields events:

```typescript
async function* query(params): AsyncGenerator<StreamEvent | Message> {
  // Stream API response
  // Extract tool calls from response
  // Execute tools (with permission checks)
  // Feed results back → loop
}
```

This handles:

- **Streaming deltas** from the API, reconstructed into complete messages
- **Tool call loop**: extract → validate → check permissions → execute → feed back
- **Recovery paths**: prompt too long → auto-compact; max tokens → retry with smaller budget
- **Parallel tool execution**: multiple tool calls run via `Promise.all` when safe

**Recommendation**: Use async generators as the core abstraction. They compose naturally, support backpressure, and make streaming a first-class citizen.

---

## 3. Multi-Layer Permission System

Permissions are checked at **every tool invocation** through multiple layers:

1. **Permission modes**: `default` (ask for everything), `plan` (read-only auto-approved), `auto` (ML classifier decides)
2. **Config rules**: File-pattern rules (e.g., `"git *" → allow`, `"rm -rf *" → deny`)
3. **Hooks**: Pre-tool-use hooks can grant/deny/modify permissions programmatically
4. **ML classifier**: In auto mode, classifies bash commands as safe/unsafe
5. **User prompt**: Last resort — ask the user

```typescript
type PermissionDecision =
  | { behavior: 'allow'; updatedInput?: Input }
  | { behavior: 'deny'; decisionReason?: string }
  | { behavior: 'ask'; pendingClassifierCheck?: Promise<...> }
```

**Recommendation**: Design permissions as a pipeline of checks, not a single gate. Each layer can allow, deny, or defer to the next. This is critical for enterprise adoption.

---

## 4. Agent Composition Patterns

Four distinct patterns for multi-agent work:

| Pattern | How | Use Case |
|---------|-----|----------|
| **Subagent** | Inline async generator, shared state | Parallel research tasks |
| **Coordinator** | Leader dispatches via Agent + SendMessage tools | Complex multi-step workflows |
| **Swarm/Team** | Tmux panes + WebSocket inbox | Concurrent independent workers |
| **Async background** | Spawn, get notified via `<task-notification>` | Long-running background work |

Agents are defined declaratively (YAML):

```yaml
name: "code-reviewer"
model: "sonnet"
tools: ["Read", "Grep", "Glob"]
systemPrompt: "You are a code reviewer..."
```

**Recommendation**: Support multiple composition patterns. Subagents for simple delegation, coordinator for orchestration, async for background work. Let agents communicate via a message-passing protocol (inbox/SendMessage).

---

## 5. Deferred Tool Loading (ToolSearch)

Not all tools are shown in the initial system prompt — that would waste tokens. Instead:

- Tools marked `shouldDefer: true` are hidden initially
- The model discovers them via a `ToolSearch` meta-tool
- ToolSearch returns the full schema, making the tool callable

**Recommendation**: Implement deferred/lazy tool loading. With many tools, the system prompt becomes huge. Let the agent discover tools on demand.

---

## 6. Hook System for Extensibility

Hooks let users inject behavior at key lifecycle points:

```typescript
type Hook = {
  type: 'pre_tool_use' | 'post_tool_use' | 'pre_request' | 'post_response'
  if: ToolPattern | Condition    // When to trigger
  then: 'prompt' | 'http' | 'agent'  // What to do
}
```

Three hook types:

- **Prompt hooks**: Inject additional instructions to the model
- **HTTP hooks**: Call external webhooks
- **Agent hooks**: Spawn a sub-agent

**Recommendation**: Hooks are the extensibility mechanism that makes the difference between a tool and a platform. They let users customize without forking.

---

## 7. Context Management & Compaction

The system handles context limits gracefully:

- **Auto-compaction**: When prompt is too long, compress older messages via a summarization pass
- **File state cache**: LRU cache avoids redundant file reads
- **Prompt caching**: Reuse cached API prompt prefixes across turns (saves tokens)
- **Large result offloading**: Tool results above a threshold are saved to disk, replaced with a pointer

**Recommendation**: Build context management into the core. Auto-compaction and result offloading are essential for long-running agent sessions.

---

## 8. Error Recovery, Not Just Error Handling

The query loop has structured recovery paths:

| Error | Recovery |
|-------|----------|
| Prompt too long | Auto-compact → retry |
| Max output tokens | Yield partial → model retries |
| Tool validation failed | Return error as tool_result → model adjusts |
| Tool execution failed | Wrap as `is_error: true` → model handles |
| Permission denied | Notification → skip (don't crash) |
| Network timeout | Exponential backoff retry |

**Recommendation**: Errors should flow back to the model as information, not crash the loop. The model is surprisingly good at recovering when told what went wrong.

---

## 9. State Architecture

```
Bootstrap (global mutable) → AppState (immutable store) → UI
                                    ↓
                              Task State (mutable map)
                              MCP State (mutable connections)
                              File Cache (LRU)
```

- Immutable state with reducer-style updates for the core
- Mutable state for things that change frequently (tasks, connections)
- Session persistence to disk (transcripts, tool results)

**Recommendation**: Separate immutable conversation state from mutable runtime state. Persist transcripts for resumability.

---

## 10. Design Principles Summary

| # | Principle | Why It Matters |
|---|-----------|----------------|
| 1 | **Tools are the universal abstraction** | Everything is a tool, even spawning agents |
| 2 | **Streaming is not optional** | Async generators everywhere, events not callbacks |
| 3 | **Permissions are first-class** | Baked into every tool call, not an afterthought |
| 4 | **Errors are data** | Flow back to the model, don't crash the loop |
| 5 | **Lazy/deferred loading** | Don't bloat the prompt with unused tool schemas |
| 6 | **Hooks for extensibility** | Pre/post lifecycle hooks at every layer |
| 7 | **Multiple agent composition** | Inline, coordinator, swarm, async patterns |
| 8 | **Context is finite** | Auto-compact, offload large results, cache aggressively |
| 9 | **Self-describing tools** | Tools declare safety properties, runtime enforces policy |
| 10 | **Resumability** | Sessions persist to disk, agents can be resumed from transcript |

---

## Priority for SDK Implementation

**Must have (P0)**:
- Tool interface with safety metadata
- Async generator query loop
- Streaming-first event model
- Error-as-data recovery loop

**Should have (P1)**:
- Multi-layer permission system
- Context compaction / auto-summarization
- Deferred tool loading
- Session persistence / resumability

**Nice to have (P2)**:
- Hook system (pre/post lifecycle)
- Multiple agent composition patterns (coordinator, swarm)
- ML-based permission classifier
- Large result offloading
