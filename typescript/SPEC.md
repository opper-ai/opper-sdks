# Opper Agent SDK v2 — Specification

> **Status:** Draft
> **Date:** 2026-03-09
> **Scope:** TypeScript/Node.js SDK for the Opper Task API, with an agent-first high-level layer

> **Design decision: no hints.** This SDK is deterministic. Model selection, temperature, and other generation parameters are set explicitly — not through a hints/preferences bag. The API's `hints` field is excluded from the SDK surface.

---

## 1. Design Philosophy

### Core Principle: Thin Client, Smart Server

The SDK is an **API-complete TypeScript client with an agent-first experience**. It exposes the core Opper primitives directly, while providing a higher-level `Agent` abstraction that is optimized for ergonomics, composition, and production use.

For the agent layer specifically, the SDK is a **thin orchestration layer**. All LLM complexity that benefits from centralization (model selection, prompt caching, native tool formats, token-efficient output) is handled server-side by the Task API. The SDK's job is:

1. Define agents and tools with good DX
2. Manage the agentic loop (call → execute tools → call again)
3. Stream results to the user
4. Provide hooks for observability

### Development Strategy: SDK-First, Then Server

New features are prototyped and validated client-side in the SDK first. Once patterns prove stable and valuable, they graduate to server-side implementation for better performance, stronger guarantees, and cross-SDK consistency. This applies to context management, memory, skills, and other advanced features.

This strategy is intentional:
- The SDK is where we can iterate fastest on developer ergonomics.
- The API is where proven concepts become platform capabilities.
- The long-term goal is to make successful SDK patterns part of the server contract where that improves reliability, performance, or interoperability.

### Two Layers, One Product

The SDK has two layers:

1. **Base client** — a complete, low-level TypeScript client that maps closely to the Opper API and exposes the core primitives directly.
2. **Agent layer** — an opinionated, higher-level runtime built on top of those primitives, with most design effort focused on agent ergonomics.

This split is important:
- The base client follows the platform closely and should feel predictable and explicit.
- The agent layer is free to be more ergonomic and opinionated when that improves the developer experience.
- When API shape and ideal SDK ergonomics differ, the base client stays API-aligned while the `Agent` API can present a friendlier abstraction.

### What the server handles (via the Task API)
- Model selection and routing
- Native tool call format per provider (OpenAI, Anthropic, Google, etc.)
- Prompt caching (automatic, per provider)
- Script generation and caching
- Usage tracking and cost calculation
- Tracing and span creation

### What the SDK handles
- Low-level API access to Opper primitives
- Agent definition (instructions, tools, schemas)
- The agentic loop ("while tool_calls > 0")
- Local tool execution
- Streaming event dispatch
- Multi-agent composition
- Hooks and lifecycle events
- Context/conversation management across turns (SDK-first, server-side later)

---

## 2. API Design

### 2.1 Defining an Agent

```typescript
import { Agent, tool } from '@opperai/agents';

const agent = new Agent({
  name: 'analytics-assistant',
  instructions: 'You help users understand their product metrics.',
  tools: [getActivationRate, queryDatabase],

  // Optional
  model: 'anthropic/claude-sonnet-4-6',       // Deterministic model selection
  temperature: 0.7,                            // Generation parameters are top-level fields
  inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
  outputSchema: { type: 'object', properties: { answer: { type: 'string' } } },
  maxIterations: 10,                           // Default: 25
  hooks: { onToolStart, onToolEnd },           // Lifecycle hooks
});
```

**Design decisions:**
- `instructions` replaces the current split of `description` + `instructions`. One field, one purpose: tell the model what this agent does and how.
- `model` is a top-level, optional, **deterministic** field. When set, this exact model is used. When omitted, the server picks its own default.
- Generation parameters (`temperature`, `maxTokens`, `reasoningEffort`) are explicit top-level fields, not grouped into a preferences bag.
- **No Zod dependency.** Schemas are plain JSON Schema objects — the native format sent to `/run`. This avoids Zod version conflicts and works with any schema library. Optional adapters are provided for popular libraries (see §2.2).
- `inputSchema` / `outputSchema` are optional. When provided, the SDK sends them to `/run` for the server to enforce, and optionally validates locally.
- No `memory` in v1 of the new SDK. Memory was tightly coupled to the think-act prompt in v1. In v2, if users need persistence, they use tools (e.g., a `readMemory` / `writeMemory` tool backed by Opper indexes or any store). This is simpler, more flexible, and doesn't pollute every LLM call.

### 2.2 Defining Tools

```typescript
import { tool } from '@opperai/agents';

// Native — zero dependencies, plain JSON Schema
const getActivationRate = tool({
  name: 'get_activation_rate',
  description: 'Fetches the current activation rate from the analytics database',
  parameters: {
    type: 'object',
    properties: {
      timeRange: {
        type: 'string',
        enum: ['7d', '30d', '90d'],
        description: 'Time range for the metric',
      },
    },
    required: ['timeRange'],
  },
  execute: async ({ timeRange }) => {
    const rate = await db.query(`SELECT activation_rate FROM metrics WHERE range = ?`, [timeRange]);
    return { rate: rate.value, period: timeRange };
  },
});
```

#### Schema library adapters (optional, zero required dependencies)

The SDK accepts plain JSON Schema as the native format. For users who prefer schema libraries, optional adapters convert to JSON Schema:

```typescript
// With Zod — user installs zod + @opperai/agents/schema/zod
import { z } from 'zod';
import { fromZod } from '@opperai/agents/schema/zod';

const getMetric = tool({
  name: 'get_metric',
  parameters: fromZod(z.object({
    metric: z.string().describe('Metric name'),
    period: z.enum(['7d', '30d', '90d']),
  })),
  execute: async ({ metric, period }) => { ... },
});

// With TypeBox — user installs @sinclair/typebox + @opperai/agents/schema/typebox
import { Type } from '@sinclair/typebox';
import { fromTypebox } from '@opperai/agents/schema/typebox';

const getMetric = tool({
  name: 'get_metric',
  parameters: fromTypebox(Type.Object({
    metric: Type.String({ description: 'Metric name' }),
  })),
  execute: async ({ metric }) => { ... },
});
```

#### Adapters work at every layer

`fromZod()` and other adapters produce plain JSON Schema. The result is usable anywhere — not just tool parameters:

```typescript
import { Agent, tool } from '@opperai/agents';
import { fromZod } from '@opperai/agents/schema/zod';
import { z } from 'zod';

const QuestionSchema = z.object({ question: z.string() });
const AnswerSchema = z.object({ answer: z.string(), confidence: z.number() });

// ─── Agent inputSchema / outputSchema ───
const agent = new Agent({
  name: 'analytics-assistant',
  instructions: 'You help users understand their product metrics.',
  inputSchema: fromZod(QuestionSchema),
  outputSchema: fromZod(AnswerSchema),
  tools: [getActivationRate],
});

// ─── Tool parameters (shown above) ───
const getActivationRate = tool({
  name: 'get_activation_rate',
  parameters: fromZod(z.object({
    timeRange: z.enum(['7d', '30d', '90d']),
  })),
  execute: async ({ timeRange }) => { ... },
});

// ─── Base client direct usage ───
const client = new Opper();
const response = await client.functions.run('my-fn', {
  input_schema: fromZod(QuestionSchema),
  output_schema: fromZod(AnswerSchema),
  input: { question: 'What is our activation rate?' },
});
```

The adapter is a pure function (`ZodSchema → JsonSchema`). It doesn't know or care which layer consumes the result.

**Design decisions:**
- Follows the industry standard pattern (OpenAI, Vercel AI SDK): `tool({ name, description, parameters, execute })`.
- **`parameters` is a JSON Schema object** — the native format sent to `/run`. No conversion needed.
- Optional `fromZod()`, `fromTypebox()`, `fromValibot()` adapters are thin wrappers (~10 lines each) in subpath exports. The user brings their own schema library as a dependency. The SDK itself has **zero required dependencies** beyond the Opper API client.
- `execute` receives the parsed input. Return value is automatically serialized to JSON.
- No `ToolResult` / `ToolResultFactory` wrapping — just return the value or throw an error. The SDK wraps it.
- No `outputSchema` on tools — the server doesn't need it, and it was mostly unused.
- **No decorator pattern.** The `tool()` function is the only way to define tools. Decorators (`@tool()`) are dropped — they require `experimentalDecorators` in tsconfig, have version compatibility issues, and no major TS agent SDK uses them (OpenAI, Vercel, Anthropic all use the function pattern). Python SDKs will use decorators since Python decorators are stable.

### 2.3 Types and Schemas

Schemas and types are a first-class part of the SDK design, not an optional convenience layer.

#### Design goals

1. **Ergonomic by default.** Common cases should require little boilerplate.
2. **Strongly typed.** Inputs, outputs, tools, events, and errors should be easy to understand from TypeScript alone.
3. **Runtime-safe.** Schemas are used not only for typing, but also for validation, serialization, and clear contracts with the model and the API.
4. **Transport-native.** JSON Schema is the wire format because it is what the server understands and can enforce directly.
5. **Library-flexible.** Users can bring their preferred schema library through thin adapters instead of being forced into one required dependency.

#### Principles

- **JSON Schema is the canonical transport format.** It is what the SDK sends to the API and what the server enforces.
- **Type inference should work in the common case.** Users should not have to manually write generic parameters unless they want to.
- **Runtime validation should happen at the boundaries.** Agent input, tool parameters, tool results, and structured outputs should be validated where mismatches are most actionable.
- **Public unions should be discriminated.** Stream events, errors, and tool outcomes should be straightforward to narrow in user code.
- **Descriptions matter.** Field descriptions are part of the prompt surface and should be treated as a core quality lever, not mere documentation.

#### What this means in practice

- Agent `inputSchema` and `outputSchema` define both the runtime contract and the expected shape of structured data.
- Tool `parameters` schemas define what the model is allowed to call and what the SDK validates before execution.
- Optional adapters such as `fromZod()` should preserve as much type information and schema metadata as possible while still producing plain JSON Schema.
- The SDK should optimize for "comfortable correctness": easy authoring, strong inference, and clear validation errors when assumptions break.

### 2.4 Running an Agent

Two explicit methods: `run()` for getting results, `stream()` for observing events.

```typescript
// ─── run(): Get the final result ───
const result = await agent.run('What is our activation rate?');
console.log(result.output);  // "Your activation rate is 34.2%"
console.log(result.usage);   // { inputTokens: 850, outputTokens: 120, cost: 0.003, ... }

// With typed input
const result = await agent.run({ question: 'What is our activation rate?' });

// With per-run overrides
const result = await agent.run('What is our activation rate?', {
  model: 'anthropic/claude-sonnet-4-6',
  temperature: 0.2,
  maxIterations: 5,
  signal: abortController.signal,
  parentSpanId: 'span-123',
});
```

### 2.5 Streaming

```typescript
// ─── stream(): Observe events as the agent works ───
for await (const event of agent.stream('What is our activation rate?')) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.text);
      break;
    case 'tool_start':
      console.log(`Calling ${event.toolName}...`);
      break;
    case 'tool_end':
      console.log(`${event.toolName} returned:`, event.result);
      break;
  }
}

// Stream AND get the final result
const stream = agent.stream('What is our activation rate?');
for await (const event of stream) {
  // observe events, show progress, log...
}
const result = await stream.result();  // Already resolved since iteration completed

// ─── In an Express handler ───
app.post('/ask', async (req, res) => {
  const result = await agent.run(req.body.question);
  res.json(result);
});

// ─── In an SSE endpoint ───
app.get('/ask-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  for await (const event of agent.stream(req.query.q)) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
});
```

#### How `AgentStream` works

```typescript
class AgentStream<TOutput> implements AsyncIterable<AgentStreamEvent<TOutput>> {
  // Iterate events
  [Symbol.asyncIterator](): AsyncIterator<AgentStreamEvent<TOutput>>;

  // Get the final result after iteration completes (or await mid-stream to block until done)
  result(): Promise<RunResult<TOutput>>;
}
```

#### Design decisions

**Two methods, one internal code path:**
- `run()` returns `Promise<RunResult>`. Internally calls `/run` (simple POST) for maximum reliability.
- `stream()` returns `AgentStream` (an `AsyncIterable`). Internally calls `/stream` (SSE) for incremental events.
- Both use the same request shape, same loop logic, same hooks. The only difference is the transport.
- Hooks fire in both modes — `onToolStart`, `onTextDelta`, etc. work regardless of whether you use `run()` or `stream()`.

**Why two methods (not one):**

| Approach | Who uses it | Trade-off |
|---|---|---|
| **Two methods**: `run()` / `stream()` | Vercel AI SDK | Explicit, simple types, easy to teach |
| **One method, parameter**: `run(input, { stream: true })` | OpenAI Agents SDK | Awkward overloads, return type depends on runtime boolean |
| **Dual-interface object** (PromiseLike + AsyncIterable) | — | Clever but fragile: edge cases around cancellation, single-consumption, accidental `Promise.all` |

We chose **two explicit methods** because:
1. **Obvious.** `run()` returns a result. `stream()` returns events. No surprises.
2. **Simple TypeScript.** `run()` returns `Promise<RunResult>`, `stream()` returns `AgentStream`. No overloads, no dual interfaces.
3. **Reliable transport.** `run()` uses `/run` (POST) — no SSE failure modes for the simplest path. `stream()` uses `/stream` (SSE) — only when you actually want streaming.
4. **Easy to teach.** Start with `run()`. When you need streaming, switch to `stream()`. Trivial refactor.
5. **Cross-language.** Every language has clear equivalents for "call and wait" vs "iterate events."

#### Wire protocol (SSE from `/stream`)

The `/stream` endpoint emits discrete SSE events. The server proxies incremental data from upstream providers in a canonical format — it does **not** buffer tool calls into a final assembled blob.

```typescript
// SSE events from the server (internal — not exposed to users)
type ServerStreamEvent =
  | { type: 'content'; delta: string }                             // Incremental text
  | { type: 'tool_call_start'; tool_call_id: string; tool_call_name: string; tool_call_index: number }
  | { type: 'tool_call_delta'; tool_call_index: number; tool_call_args: string }  // JSON fragment
  | { type: 'done'; usage?: UsageInfo }                            // Stream complete
  | { type: 'error'; error: string };                              // Server error
```

The SDK accumulates tool call arguments internally (string concatenation per index, then `JSON.parse` when complete). This matches the industry standard — Anthropic (`input_json_delta` + `content_block_stop`), OpenAI (`tool_calls[i].function.arguments` deltas), and Vercel AI SDK (`tool-input-delta` + `tool-input-available`) all stream tool call arguments incrementally.

**Why no "final assembled response" event:** The SDK can trivially assemble the response from discrete events. A redundant final blob would require server-side buffering, add bandwidth, and duplicate data already in the stream.

#### User-facing stream event types

Users see a higher-level event stream. The SDK never exposes raw `tool_call_delta` events — it accumulates tool call arguments internally and emits only complete, actionable events.

```typescript
type AgentStreamEvent<TOutput> =
  | { type: 'iteration_start'; iteration: number }
  | { type: 'text_delta'; text: string }                           // Pass-through from wire `content` events
  | { type: 'tool_start'; toolName: string; toolCallId: string; input: unknown }  // Emitted after args fully accumulated
  | { type: 'tool_end'; toolName: string; result: unknown; error?: string; durationMs: number }
  | { type: 'iteration_end'; iteration: number; usage: Usage }
  | { type: 'result'; output: TOutput; usage: Usage }
  | { type: 'error'; error: Error };
```

#### `RunResult` shape

```typescript
interface RunResult<TOutput> {
  output: TOutput;                    // The final output (validated against outputSchema if provided)
  usage: Usage;                       // Aggregated token usage across all iterations
  iterations: number;                 // How many loop iterations were needed
  toolCalls: ToolCallRecord[];        // Full log of all tool calls made
  meta: ResponseMeta;                 // Server metadata (models used, cost, cache stats)
}
```

### 2.6 Multi-Agent Composition

#### Pattern 1: Agent as Tool (recommended)

```typescript
const researchAgent = new Agent({
  name: 'researcher',
  instructions: 'You research topics thoroughly.',
  tools: [webSearch, readUrl],
});

const writerAgent = new Agent({
  name: 'writer',
  instructions: 'You write clear, concise reports.',
  tools: [
    researchAgent.asTool('research', 'Research a topic and return findings'),
  ],
});

const result = await writerAgent.run('Write a report on AI agent frameworks');
```

- `asTool(name, description)` wraps the agent as a tool. When called, it runs the sub-agent to completion and returns its output.
- Usage from sub-agents is automatically tracked in the parent's `result.usage` with a breakdown by agent name.
- The sub-agent runs with its own set of iterations — it does NOT count against the parent's `maxIterations`.

#### Pattern 2: Handoffs (inspired by OpenAI)

```typescript
const triageAgent = new Agent({
  name: 'triage',
  instructions: 'Route the user to the right specialist.',
  handoffs: [billingAgent, technicalAgent, generalAgent],
});

const result = await triageAgent.run('I need a refund');
// → triageAgent hands off to billingAgent, which handles the request
```

- `handoffs` are agents that the current agent can transfer control to.
- They appear as tools to the model (e.g., `transfer_to_billing`).
- When a handoff is triggered, the current agent stops and the target agent takes over with the full conversation context.
- The final result comes from whichever agent finishes.
- *Note: This is a stretch goal. `asTool()` covers most use cases. Handoffs add value for customer-service-style routing.*

### 2.7 Hooks

```typescript
const agent = new Agent({
  name: 'my-agent',
  instructions: '...',
  tools: [...],
  hooks: {
    onAgentStart:    ({ input, context }) => { ... },
    onAgentEnd:      ({ output, usage, error, context }) => { ... },
    onIterationStart:({ iteration, context }) => { ... },
    onIterationEnd:  ({ iteration, usage, context }) => { ... },
    onToolStart:     ({ toolName, input, context }) => { ... },
    onToolEnd:       ({ toolName, result, error, duration, context }) => { ... },
    onLLMCall:       ({ iteration, context }) => { ... },
    onLLMResponse:   ({ iteration, usage, hasToolCalls, context }) => { ... },
    onTextDelta:     ({ text, context }) => { ... },
  },
});
```

**Design decisions:**
- Hooks in constructor (like OpenAI SDK) rather than `.on()` / `.off()`. Simpler, more discoverable.
- Every hook receives `context` — a mutable bag the user can use to track custom state across the run.
- Hooks are **sync or async** — the SDK awaits them.
- Keep it to ~10 hooks max. The v1 SDK had 17 which was excessive.
- No separate `HookManager` class — just plain callbacks.

### 2.8 MCP Integration

```typescript
import { Agent, mcp } from '@opperai/agents';

const agent = new Agent({
  name: 'file-assistant',
  instructions: 'Help users manage files.',
  tools: [
    mcp({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] }),
  ],
});
```

- `mcp()` returns a `ToolProvider` — an object the SDK knows to `setup()` before the run and `teardown()` after.
- Tools from MCP servers are discovered via `listTools()` and converted to the SDK's tool format.
- MCP tool names are prefixed: `mcp__<server>__<toolname>`.
- Supports stdio, SSE, and HTTP transports.

---

## 3. The Agentic Loop — How It Works

### 3.1 The Loop (Client-Side)

The loop is the same for both `run()` and `stream()`. The only difference is the transport (`/run` POST vs `/stream` SSE) and whether events are yielded to the caller.

```
agent.run(input) / agent.stream(input):

1. Setup: resolve ToolProviders (MCP setup, skill loading)
2. Convert tool parameters to JSON Schema format
3. Build initial messages: [{ role: "system", content: instructions }, { role: "user", content: input }]
4. → Hook: onAgentStart

LOOP (iteration = 1..maxIterations):
  5. → Hook: onIterationStart, onLLMCall
     (stream mode: yield { type: 'iteration_start', iteration })

  6. Call server:
     - run() mode:  POST /functions/{agent.name}/run   → JSON response
     - stream() mode: POST /functions/{agent.name}/stream → SSE events

     Body: {
       input_schema: <messages schema>,
       output_schema: <response-with-tool-calls schema>,
       input: { messages },
       model: agent.model,                          // Deterministic, if set
       temperature: agent.temperature,
       max_tokens: agent.maxTokens,
       tools: [{ name, description, parameters }],
       parent_span_id: parentSpanId,
     }

  7. Consume response:
     - run() mode: parse JSON response (content + tool_calls)
     - stream() mode: consume SSE events:
       - `content` events → yield { type: 'text_delta' } to user, accumulate into content string
       - `tool_call_start` events → record tool call id, name, index; start accumulating args
       - `tool_call_delta` events → append args fragment to pending tool call (string concat)
       - `done` event → JSON.parse each accumulated tool call's args, build complete tool_calls array
       The SDK assembles the complete response from discrete events — the server does NOT
       send a separate final assembled blob.
     → Hook: onLLMResponse

  8. If NO tool_calls in response → DONE
     - Validate output against outputSchema if provided
     - → Hook: onAgentEnd
     - (stream mode: yield { type: 'result', output, usage })
     - Return RunResult

  9. Append assistant message to messages:
     messages.push({ role: "assistant", content, tool_calls })

  10. Execute tools locally (parallel by default):
      Tool execution starts AFTER all tool calls are fully received (after `done` event).
      No early/speculative tool execution from partial stream data in v1.
      For each tool_call:
        - → Hook: onToolStart (stream: yield { type: 'tool_start', toolName, input })
        - Find matching tool by name
        - Call tool.execute(parsedArgs)
        - → Hook: onToolEnd (stream: yield { type: 'tool_end', toolName, result })
        - On error: serialize error as tool result (don't throw)

  11. Append tool results to messages:
      messages.push({ role: "tool", tool_call_id, content: JSON.stringify(result) }, ...)

  12. → Hook: onIterationEnd
      (stream mode: yield { type: 'iteration_end', iteration, usage })
  13. Continue loop

14. If maxIterations reached → throw MaxIterationsError (with partial result)
15. Teardown: ToolProviders cleanup (MCP teardown)
```

**Tool call assembly from stream:** The SDK accumulates tool calls from `tool_call_start` and `tool_call_delta` SSE events. This is trivial: concatenate argument fragments per tool call index, then `JSON.parse` the complete string when the `done` event arrives. This matches the industry standard — Anthropic, OpenAI, and Vercel AI SDK all stream tool call arguments incrementally. The server proxies what providers emit in a normalized format without buffering.

**No early tool execution in v1.** Tool execution waits until all tool calls in the response are fully received (after the `done` event). The `tool_call_start` event delivers the tool name early, which enables future optimizations (connection pre-warming, resource preparation), but v1 does not act on partial data. Early execution can be added as an opt-in experiment if latency data justifies it.

### 3.2 Message Format

The SDK uses a **provider-agnostic message format** that maps to the standard chat messages pattern:

```typescript
type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentBlock[] }
  | { role: 'assistant'; content: string; tool_calls?: ToolCallMessage[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type ToolCallMessage = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};
```

**The server translates this to the native format for each provider.** The SDK doesn't need to know if it's talking to Anthropic, OpenAI, or Google — the Task API handles that. This is the key architectural advantage.

#### Tool Call Contract

Tool calling differs across providers, but the SDK should not need to care. The server owns provider-specific tool-call behavior and exposes a stable canonical contract to the SDK:

- **In `/run` responses:** A tool call has a stable opaque `id`, a `name`, and fully parsed `arguments`
- **In `/stream` responses:** A tool call is delivered incrementally — `tool_call_start` provides the `id`, `name`, and `index` upfront; `tool_call_delta` events deliver argument fragments. The SDK assembles the complete tool call from these events.
- The SDK treats the `id` as opaque and only uses it to correlate tool results
- If a provider does not supply a usable tool call ID, the server generates one
- The same logical tool call has the same canonical `id` in `/run` responses, `/stream` responses, and tool result messages

This keeps provider quirks on the server side and reduces the SDK's responsibility to simple run-local bookkeeping.

### 3.3 What the Server Does Per Call

Both `/run` and `/stream` share the same execution model:

1. Receives messages + tools + model + generation parameters
2. Resolves model (from explicit `model` field, or server default)
3. Converts tools to provider-native format (Anthropic `tools[]`, OpenAI `functions[]`, etc.)
4. Applies prompt caching breakpoints (provider-specific)
5. Calls the LLM with native tool calling enabled
6. Returns response with `content` and/or `tool_calls`
   - `/run`: returns complete JSON response
   - `/stream`: returns SSE events — `content` (text deltas), `tool_call_start` + `tool_call_delta` (incremental tool calls), and `done` (usage/meta). No final assembled blob.
7. Tracks usage, creates spans

### 3.4 Why This Architecture Beats V1

| Concern | V1 (Current SDK) | V2 (This Spec) |
|---|---|---|
| **LLM call format** | Custom `input` JSON with embedded tools, history, instructions | Native messages format, server converts per provider |
| **Tool definitions** | Embedded in prompt text | First-class `tools` parameter, server converts to native format |
| **Prompt caching** | Not possible (each call is independent) | Server applies cache breakpoints; stable prefix (system + tools) is cached |
| **Output format** | Custom `AgentDecision` JSON schema | Native tool_calls from provider, no parsing overhead |
| **System prompt** | ~450 tokens of think-act scaffolding per call | Agent's `instructions` only — the server/model handles reasoning natively |
| **Token overhead** | ~5,000+ extra tokens per run | Minimal — only the actual conversation |
| **Model compatibility** | Depends on model understanding custom schema | Works with any model that supports tool calling |
| **Latency** | Client → Opper API → model (custom format translation) | Client → Task API → model (native format, optimized) |

---

## 4. Configuration & Client Setup

### 4.1 Client Initialization

```typescript
import { Opper } from '@opperai/agents';

// From environment (OPPER_API_KEY, OPPER_BASE_URL)
const opper = new Opper();

// Top-level run/stream — name as first parameter, mirrors the API path
const response = await opper.run('summarize', {
  instructions: 'Summarize the input',
  input: { text: '...' },
  outputSchema: {
    type: 'object',
    properties: { summary: { type: 'string' } },
    required: ['summary'],
  },
});

for await (const event of opper.stream('summarize', {
  instructions: 'Summarize the input',
  input: { text: '...' },
})) {
  // raw stream events from the Task API
}

// Explicit
const opper = new Opper({
  apiKey: 'op-...',
  baseUrl: 'https://api.opper.ai',  // Default
});

// Agents created from client
const agent = opper.agent({
  name: 'my-agent',
  instructions: '...',
  tools: [...],
});

// Or standalone (uses OPPER_API_KEY env var)
const agent = new Agent({ name: '...', instructions: '...', tools: [...] });
```

### 4.2 Model Selection & Generation Parameters

`model` is a top-level, optional, **deterministic** field. When set, this exact model is used. When omitted, the server picks its own default. Generation parameters (`temperature`, `maxTokens`, `reasoningEffort`) are explicit top-level fields.

```typescript
// Let the server pick the best model (default)
const agent = new Agent({
  name: 'assistant',
  instructions: '...',
});

// Deterministic model selection
const agent = new Agent({
  name: 'assistant',
  instructions: '...',
  model: 'anthropic/claude-sonnet-4-6',  // This exact model, always
});

// Per-run override
await agent.run(input, { model: 'openai/gpt-4o' });

// Generation parameters are top-level fields
const agent = new Agent({
  name: 'assistant',
  instructions: '... Always respond in Swedish.',  // All guidance goes here
  model: 'anthropic/claude-sonnet-4-6',
  temperature: 0.2,
  maxTokens: 4096,
  reasoningEffort: 'medium',
});
```

---

## 5. Error Handling

```typescript
import { AgentError, ToolError, MaxIterationsError, AbortError } from '@opperai/agents';

try {
  const result = await agent.run(input);
} catch (error) {
  if (error instanceof MaxIterationsError) {
    // Agent hit iteration limit without completing
    console.log(error.lastOutput);      // Partial result if available
    console.log(error.iterations);      // How many iterations ran
    console.log(error.toolCalls);       // All tool calls made
  } else if (error instanceof AbortError) {
    // Run was cancelled via signal
  } else if (error instanceof AgentError) {
    // Server error, network error, etc.
  }
}
```

**Tool errors don't throw** — they're fed back to the model as error results:
```typescript
const riskyTool = tool({
  name: 'risky',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  execute: async ({ id }) => {
    const item = await db.get(id);
    if (!item) throw new Error('Item not found');  // ← This becomes a tool error message
    return item;                                    //   sent back to the model, NOT thrown
  },
});
```

---

## 6. Advanced Features

### 6.1 Parallel Tool Execution

Tools execute **in parallel by default** (unlike v1 which was sequential by default). If a model returns multiple tool_calls in a single response, they all run concurrently:

```typescript
// Opt into sequential execution if needed
const agent = new Agent({
  parallelToolExecution: false,  // Default: true
  ...
});
```

### 6.3 Tool Timeouts

```typescript
const slowTool = tool({
  name: 'slow_query',
  parameters: {
    type: 'object',
    properties: { sql: { type: 'string' } },
    required: ['sql'],
  },
  timeoutMs: 30_000,  // 30 second timeout
  execute: async ({ sql }) => { ... },
});
```

### 6.4 Abort / Cancellation

```typescript
const controller = new AbortController();

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30_000);

const result = await agent.run(input, { signal: controller.signal });
```

### 6.5 Conversation / Multi-Turn

For multi-turn conversations where the agent needs prior context:

```typescript
// Option 1: Pass messages directly
const result = await agent.run({
  messages: [
    { role: 'user', content: 'My name is Alice' },
    { role: 'assistant', content: 'Nice to meet you, Alice!' },
    { role: 'user', content: 'What is my name?' },
  ],
});

// Option 2: Use a conversation helper
const conversation = agent.conversation();

const r1 = await conversation.send('My name is Alice');
// conversation internally tracks messages

const r2 = await conversation.send('What is my name?');
// r2.output → "Your name is Alice"
```

The `conversation()` helper:
- Maintains the messages array across `.send()` calls
- Appends each assistant response and user message
- Handles tool calls transparently within each turn
- **Does NOT persist across process restarts** (stateless — it's just an in-memory array)

---

## 7. Package Structure

```
@opperai/agents
├── src/
│   ├── index.ts              # Public API exports
│   ├── client.ts             # Base Opper client, aligned with the API
│   ├── client-types.ts       # Low-level request/response types
│   ├── agent.ts              # High-level Agent class (run + stream)
│   ├── tool.ts               # tool() function + types
│   ├── loop.ts               # Agentic loop (shared by Agent methods)
│   ├── conversation.ts       # Multi-turn conversation helper
│   ├── types.ts              # Public high-level types
│   ├── errors.ts             # Error classes
│   ├── hooks.ts              # Hook types and dispatch
│   ├── mcp/
│   │   ├── provider.ts       # MCP tool provider
│   │   └── client.ts         # MCP client
│   ├── schema/               # Optional schema adapters (subpath exports)
│   │   ├── zod.ts            # fromZod() — requires zod as peer dep
│   │   ├── typebox.ts        # fromTypebox() — requires @sinclair/typebox
│   │   └── valibot.ts        # fromValibot() — requires valibot
│   └── utils/
│       └── logger.ts         # Logging
```

### Public Exports

```typescript
// Base client + agent layer — main entry point '@opperai/agents'
export { Opper } from './client';
export { Agent } from './agent';
export { tool } from './tool';
export { mcp } from './mcp';

// Types
export type {
  AgentConfig,
  AgentStream,
  RunResult,
  RunOptions,
  Usage,
  ToolDefinition,
  ToolConfig,
  ToolCallRecord,
  ToolContext,
  ToolProvider,
  AgentStreamEvent,
  Hooks,
  JsonSchema,
  Message,
  ResponseMeta,
} from './types';

export type {
  RunRequest,
  StreamRequest,
  RunResponse,
  StreamEvent,
} from './client-types';

// Errors
export {
  AgentError,
  ToolError,
  MaxIterationsError,
  AbortError,
} from './errors';

// Schema adapters — subpath exports (optional, zero impact on bundle if not used)
// import { fromZod } from '@opperai/agents/schema/zod'
// import { fromTypebox } from '@opperai/agents/schema/typebox'
// import { fromValibot } from '@opperai/agents/schema/valibot'
```

---

## 8. What We Need From the Task API

This SDK deliberately experiments in the SDK first and graduates proven patterns to the API later. That only works if the server contract is sharp where the SDK depends on it, and flexible where experimentation is still happening.

For v2, the `Agent` layer depends on the following Task API contract.

### 8.1 Required Server Contract

1. **Two first-class transports with the same semantics.**
   - `POST /run` returns the completed response as JSON.
   - `POST /stream` returns incremental SSE events for the same execution model.
   - Both endpoints must accept the same request shape and produce the same final semantic result.

2. **Canonical message input.**
   - The API must accept a stable provider-agnostic message format from the SDK.
   - The SDK sends canonical messages; the server is responsible for translating them to provider-native formats.
   - `system` instructions must be supported, either as `role: "system"` messages or an equivalent explicit field.

3. **First-class tool definitions in the request.**
   - Tools must be passed as structured input, not embedded into prompt text.
   - Each tool must include `name`, `description`, and `parameters` as JSON Schema.
   - The server is responsible for converting tool definitions to provider-native tool/function formats.

4. **Native tool calls in the response.**
   - When the model wants to call tools, the response must include tool calls.
   - **`/run`:** Each tool call includes a stable opaque `id`, `name`, and fully parsed `arguments` in the JSON response.
   - **`/stream`:** Tool calls are delivered incrementally via `tool_call_start` (provides `id`, `name`, `index`) and `tool_call_delta` (provides argument fragments) SSE events. The SDK assembles the complete tool call from these events.
   - If the provider does not expose a reliable ID, the server generates one.
   - The same logical tool call has the same `id` across both transports and in tool result messages.

5. **Tool results must round-trip through the API.**
   - The API must accept tool result messages that reference the original `tool_call_id`.
   - This is non-negotiable for client-side agentic loops.
   - The server must preserve the association between tool calls and tool results when translating to provider-native formats.
   - The SDK should never need provider-specific logic for tool-call identity or matching.

6. **Streaming must support text deltas and incremental tool call events.**
   - `/stream` must emit `content` events with incremental text for user-facing output.
   - `/stream` must emit `tool_call_start` and `tool_call_delta` events for incremental tool call delivery. The server proxies what providers emit in a normalized format — it does **not** need to buffer tool calls into a final assembled blob.
   - `/stream` must emit a `done` event with usage metadata when the response is complete.
   - The SDK assembles the complete response from these discrete events. This matches the industry standard (Anthropic, OpenAI, Vercel AI SDK).

7. **Usage and tracing must be surfaced per call.**
   - Every call must return usage.
   - Every call must support trace/span linkage via `parentSpanId` or equivalent.
   - The server owns authoritative model usage, cost, and span creation.

8. **Model selection must support explicit and guided modes.**
   - If `model` is provided, the server uses that model deterministically.
   - If `model` is omitted, the server uses its own default.
   - The server remains responsible for final provider/model resolution behavior.

### 8.2 Required Stability Properties

The following properties matter as much as the fields themselves:

1. **Shape parity.** `/run` and `/stream` must not diverge in accepted input shape or final response semantics.
2. **Provider abstraction.** Provider-specific details stay on the server side.
3. **Forward compatibility.** The canonical message and tool formats must be stable enough for SDKs in multiple languages to depend on.
4. **Server authority.** Usage, cost, and tracing are owned by the server, not recomputed in the SDK.

### 8.3 What Stays SDK-First for Now

These areas are intentionally allowed to evolve in the SDK before we lock them into the API:

- Conversation helpers and multi-turn convenience APIs
- Context management and context-window strategies
- Memory patterns built on top of tools and knowledge/index primitives
- Skills loading and composition
- Agent handoffs and higher-level multi-agent coordination
- Built-in client ergonomics around retries, batching, and helper abstractions

When one of these patterns proves valuable and stable, the preferred direction is to move it into the API where that improves performance, consistency, or cross-language portability.

### 8.4 Strong Nice-to-Haves

These are not required to ship v2, but they are strategically important:

1. **Prompt caching or automatic cache segmentation** for stable prefixes such as instructions and tool definitions.
2. **Usage breakdown fields** such as `cache_read_tokens`, `cache_creation_tokens`, and richer cost metadata.
3. **Server-side safety limits** such as `max_llm_calls` to guard against buggy clients.
4. **Conversation identifiers** if they can improve cache reuse or enable future server-managed conversation features.

### 8.5 Explicit Non-Goals for V2

- Server-side execution of the full agentic loop
- Early/speculative tool execution from partial stream data (tool call deltas are streamed, but execution waits for all tool calls to complete)
- Server-managed memory as a mandatory part of every agent call
- Locking advanced SDK experiments into the API before they have proved their value

---

## 9. Migration Notes (V1 → V2)

| V1 Concept | V2 Equivalent | Notes |
|---|---|---|
| `new Agent({ description, instructions })` | `new Agent({ instructions })` | Merged into one field |
| `createFunctionTool(fn, opts)` | `tool({ execute: fn, ...opts })` | Industry-standard pattern |
| `ToolResultFactory.success(name, data)` | `return data` | Just return from execute |
| `ToolResultFactory.failure(name, err)` | `throw err` | Just throw from execute |
| `agent.process(input)` | `agent.run(input)` | Renamed |
| `onStreamChunk` callback | `for await (const e of agent.stream())` | Async iterator |
| `HookEvents.AgentStart` enum | `hooks: { onAgentStart }` | Plain callbacks |
| `agent.registerHook(event, fn)` | `hooks: { [event]: fn }` | Declarative |
| `Memory` / `InMemoryStore` | Use tools | Memory as tools, not a special system |
| `AgentDecision` type | Gone | Model uses native tool calling |
| `executionHistory` | `messages` array | Standard conversation format |
| `context.contextUtilization` | `result.meta.contextUtilization` | SDK-side first, server-side later |
| `enableStreaming: true` | `agent.stream()` | Explicit method for streaming |

---

## 10. Minimal Example — End to End

```typescript
import { Agent, tool } from '@opperai/agents';

// Define a tool — plain JSON Schema, zero dependencies
const getMetric = tool({
  name: 'get_metric',
  description: 'Fetch a product metric by name',
  parameters: {
    type: 'object',
    properties: {
      metric: { type: 'string', description: 'Metric name, e.g. "activation_rate"' },
      period: { type: 'string', enum: ['7d', '30d', '90d'], default: '30d' },
    },
    required: ['metric'],
  },
  execute: async ({ metric, period }) => {
    const value = await analyticsDB.getMetric(metric, period);
    return { metric, period, value };
  },
});

// Define the agent
const agent = new Agent({
  name: 'analytics',
  instructions: 'You help users understand product metrics. Be concise.',
  tools: [getMetric],
  temperature: 0.7,
});

// Run it — just await
const result = await agent.run('What is our activation rate?');
console.log(result.output);
// → "Your activation rate over the last 30 days is 34.2%."
console.log(result.usage);
// → { inputTokens: 850, outputTokens: 120, totalTokens: 970, cost: 0.003, llmCalls: 2 }

// Stream it — explicit method
for await (const event of agent.stream('What is our activation rate?')) {
  if (event.type === 'text_delta') process.stdout.write(event.text);
}
```

### What happens under the hood:

```
SDK                                    Task API                           LLM Provider
 │                                         │                                  │
 │  POST /functions/analytics/run          │                                  │
 │  (or /stream for agent.stream())        │                                  │
 │  { messages: [{user: "What is..."}],    │                                  │
 │    tools: [{name: "get_metric",...}],    │                                  │
 │    temperature: 0.7 }                   │                                  │
 │ ──────────────────────────────────────► │                                  │
 │                                         │  Native API call with tools      │
 │                                         │  (prompt caching applied)        │
 │                                         │ ───────────────────────────────► │
 │                                         │                                  │
 │                                         │  ◄── tool_calls: [get_metric]    │
 │  ◄── { tool_calls: [{                  │                                  │
 │         name: "get_metric",             │                                  │
 │         arguments: {metric:             │                                  │
 │           "activation_rate"}            │                                  │
 │       }] }                              │                                  │
 │                                         │                                  │
 │  [Execute tool locally]                 │                                  │
 │  get_metric({metric: "activation_rate"})│                                  │
 │  → { metric: "activation_rate",         │                                  │
 │      value: 0.342 }                     │                                  │
 │                                         │                                  │
 │  POST /functions/analytics/run          │                                  │
 │  { messages: [                          │                                  │
 │      {user: "What is..."},              │                                  │
 │      {assistant: "", tool_calls:[...]}, │                                  │
 │      {tool: result}                     │                                  │
 │    ],                                   │                                  │
 │    tools: [...],                        │                                  │
 │    temperature: 0.7 }                    │                                  │
 │ ──────────────────────────────────────► │                                  │
 │                                         │  Native API call                 │
 │                                         │  (prefix CACHED — 90% cheaper)   │
 │                                         │ ───────────────────────────────► │
 │                                         │                                  │
 │                                         │  ◄── "Your activation rate..."   │
 │  ◄── { content: "Your activation        │                                  │
 │        rate is 34.2%..." }              │                                  │
 │                                         │                                  │
 │  Return RunResult to user               │                                  │
```

---

## 11. Implementation Notes

### Priority Order
1. **Core:** `Agent`, `tool()`, `agent.run()`, the loop with `/run` — get this working end-to-end
2. **Streaming:** `agent.stream()` with SSE from `/stream` endpoint
3. **Multi-agent:** `agent.asTool()` with trace propagation — straightforward once the core works
4. **MCP:** Port from v1, adapt to new tool format
5. **Hooks:** Add hook dispatch points in the loop
6. **Conversation helper:** Simple wrapper, low effort
7. **Schema adapters:** `fromZod()`, `fromTypebox()` subpath exports
8. **Context management:** SDK-side implementation (see §12 Roadmap)

### Key Implementation Concerns
- **Shared loop logic:** `run()` and `stream()` share the same loop implementation. The difference is transport (`/run` vs `/stream`) and whether events are yielded. Consider implementing the loop as an internal async generator that both methods consume — `run()` collects silently, `stream()` exposes events.
- **SSE parsing and tool call assembly:** The `/stream` endpoint returns SSE with `content`, `tool_call_start`, `tool_call_delta`, and `done` events. The SDK accumulates tool call arguments via string concatenation per `tool_call_index`, then `JSON.parse` each when the `done` event arrives. Text `content` deltas are yielded as `text_delta` events immediately. Tool execution begins only after `done` (all tool calls complete).
- **Tool call ID matching:** When sending tool results back, they must reference the `id` from the original tool_call. The SDK must track this mapping.
- **Parallel tool execution:** Use `Promise.allSettled()` for parallel tool calls. Track individual timing.
- **Error recovery:** If a tool throws, send the error message back to the model as a tool result (not throw from the run). The model can retry or work around it.
- **AbortSignal propagation:** Pass the signal to fetch calls and tool executions. Clean up on abort.
- **Trace propagation for asTool:** When a sub-agent runs via `asTool()`, the parent's span ID flows as `parentSpanId` to the child. The server creates nested spans. The SDK aggregates usage in `result.usage.breakdown`.

### Testing Strategy
- **Unit tests:** Tool schema conversion, message building, result parsing
- **Integration tests:** Full loop against mock `/run` and `/stream` endpoints that return canned tool_calls
- **E2E tests:** Against real Task API with simple tools (calculator, echo)
- **Benchmark:** Compare token usage and latency against direct Anthropic SDK for the same task

---

## 12. Roadmap — Stretch Goals

### 12.1 Usage, Cache, Cost Overview

The server returns rich metadata; the SDK surfaces it cleanly in `RunResult`:

```typescript
const result = await agent.run(input);
result.usage.inputTokens           // 850
result.usage.outputTokens          // 120
result.usage.cacheReadTokens       // 700  — how many tokens were served from cache
result.usage.cacheWriteTokens      // 150
result.usage.cost                  // 0.003
result.usage.llmCalls              // 2
result.usage.breakdown             // { 'research-agent': { ... } }  — per sub-agent
result.meta.contextUtilization     // 0.35  (35% of context window used)
result.meta.modelsUsed             // ['anthropic/claude-sonnet-4-6']
```

**Effort:** Low SDK, medium server. The server needs to return `cache_read_tokens`, `cache_creation_tokens`, `cost`, `context_utilization` in response meta.

### 12.2 Skills (Client-Side First)

Skills are reusable agent capabilities from [skills.sh](https://skills.sh). They are not ordinary tools: they use **progressive disclosure**. The model first sees only compact front matter, and deeper sections of the skill are disclosed later when needed.

```typescript
import { Agent, loadSkill } from '@opperai/agents';

// Load a skill — a progressively disclosed capability
const webResearch = await loadSkill('web-research');

const agent = new Agent({
  name: 'researcher',
  instructions: '...',
  skills: [webResearch],
  tools: [myLocalTool],
});
```

**How it works (client-side):**
- Skills are installed locally (e.g., in a `.opper/skills/` directory, globally or per-project)
- `loadSkill(name)` discovers the skill definition from the local filesystem and loads its front matter plus the disclosed sections on demand
- The model initially sees only the skill's front matter: name, summary, and the minimal metadata needed to decide whether to use it
- Further parts of the skill are revealed progressively as the agent requests them
- A skill may disclose one or more tools, examples, workflows, or additional instructions over time
- The SDK recommends a conventional location (`.opper/skills/`) but searches flexibly

**Recommended file structure:**
```
.opper/
  skills/
    web-research/
      SKILL.md            # Progressive-disclosure skill content
      skill.json          # Manifest / front matter
      index.ts            # Optional tool implementations
    document-analysis/
      SKILL.md
      skill.json
      index.ts
```

**Why skills are special:**
- They are capability bundles, not just a single `execute()` function
- Their content is intentionally staged to save context and let the model pull detail only when needed
- They may disclose tools, instructions, examples, or deeper procedural sections instead of behaving like a flat tool definition

**Future:** Once the disclosure pattern is stable, the API could support first-class `skills` alongside `tools`. The server would receive skill references plus front matter, manage progressive disclosure, and only expand the necessary sections into the model context or tool surface.

### 12.3 Agent Deploy

Deploy an agent to Opper as a hosted service. The user gets an endpoint they can call without running the SDK locally.

```typescript
const deployment = await agent.deploy({
  // Tool implementations must be reachable by the server
  toolEndpoint: 'https://my-api.com/tools',  // Webhook for tool execution
});

console.log(deployment.url);     // https://agents.opper.ai/my-analytics-agent
console.log(deployment.apiKey);  // For authentication
```

**Preferred approach: Container-based** (like Google ADK's `adk deploy`). The agent + tool implementations are packaged into a Docker container and deployed to Opper's infrastructure. This avoids the webhook complexity and runs the full SDK server-side.

**Alternative: Webhook-based.** Agent config (instructions, tool schemas, generation parameters) is stored on Opper. Tool execution goes through webhooks to the user's service. Simpler to implement but requires the user to host a webhook endpoint.

**Effort:** High (significant server infrastructure). Stretch goal for future.

### 12.4 Context Management (SDK-First)

Prevent context window overflow in long-running agents. **Start with SDK-side implementation, migrate to server-side once patterns are proven.**

```typescript
const agent = new Agent({
  name: 'long-running',
  instructions: '...',
  contextManagement: {
    strategy: 'summarize',         // 'summarize' | 'truncate' | 'sliding-window'
    maxContextTokens: 100_000,     // Trigger threshold
    keepLastN: 5,                  // Always keep last N messages
  },
});
```

**SDK-side implementation (v1):**
- Track approximate token count of the messages array (using a fast tokenizer estimate or character-based heuristic)
- When approaching `maxContextTokens`, apply the chosen strategy:
  - **`summarize`**: Make an extra LLM call to summarize old messages, replace them with the summary
  - **`truncate`**: Drop oldest messages (keep system + last N)
  - **`sliding-window`**: Keep a fixed window of recent messages, drop the rest
- The SDK manages this transparently — the user's conversation just works

**Server-side implementation (future):**
- Once we know which strategies users prefer, move the logic server-side
- The server can apply provider-specific optimizations (e.g., Anthropic's `compact` API, tool result clearing)
- The SDK sends `context_management` config to `/run` and the server handles it

### 12.5 Built-In Tools (Server-Side)

Opper-managed tools that execute server-side. No local implementation needed — the user just references them:

```typescript
import { Agent, opperTools } from '@opperai/agents';

const agent = new Agent({
  name: 'researcher',
  instructions: '...',
  tools: [
    opperTools.search({ indexes: ['knowledge-base'] }),  // Opper semantic search
    opperTools.webSearch(),                                // Web search
    opperTools.codeInterpreter(),                          // Sandboxed code execution
    myLocalTool,                                           // User's own tool
  ],
});
```

**How it works:**
- `opperTools.*` helpers return tool definitions where `execute` calls the Opper API to run the tool server-side
- From the model's perspective, they're just tools — it doesn't know they're server-side
- Saves a round-trip vs local execution for tools that Opper can run faster (search, code execution)

**Effort:** Low SDK (helpers are thin wrappers), medium server (endpoints for each built-in tool).

### 12.6 Memory via Opper Indexes

Persistent memory backed by Opper's vector search indexes. Implemented as a tool, not a special system:

```typescript
import { Agent, opperTools } from '@opperai/agents';

const agent = new Agent({
  name: 'assistant',
  instructions: 'You remember user preferences across conversations.',
  tools: [
    opperTools.memory({
      index: 'user-preferences',         // Opper index for storage
      operations: ['read', 'write', 'search'],  // What the agent can do
    }),
  ],
});
```

**Advantages over v1's built-in memory:**
- No `memoryReads` / `memoryUpdates` polluting every agent decision
- The model uses memory only when it makes sense (as a tool call)
- Backed by real vector search (Opper indexes), not just key-value
- Persists across sessions automatically
- Can be shared across agents
- Searchable — "find memories related to X"

**Effort:** Low SDK (it's a tool), medium server (index read/write endpoints).

### 12.7 Forced Reasoning (Stretch)

For models without native reasoning/thinking support, the SDK could inject chain-of-thought prompting:

```typescript
const agent = new Agent({
  name: 'analyst',
  instructions: '...',
  reasoningEffort: 'medium',
});
```

**Preferred approach:** Handle server-side. The SDK sends `reasoningEffort`, the server checks if the model supports native reasoning. If yes → uses it. If no → injects chain-of-thought in the prompt. The SDK stays thin and doesn't need to know about model capabilities.

### 12.8 Early Tool Execution from Streaming

Reduce end-to-end latency by starting tool execution before the full streamed model response has completed.

```typescript
const agent = new Agent({
  name: 'researcher',
  instructions: '...',
  experimental: {
    earlyToolExecution: true,
  },
});
```

**Why this is a stretch goal:**
- The wire protocol already delivers `tool_call_start` (with tool name) before arguments are complete, so the SDK *could* begin execution as soon as a single tool call's arguments are fully received — without waiting for other tool calls in the same response.
- The main complexity is handling cancellation and error recovery if a later tool call changes the execution plan.
- Different from the current v1 behavior where all tool calls must be fully received before any execution begins.

**Preferred rollout strategy:**
- Start as an SDK experiment behind an explicit opt-in flag.
- Measure actual latency improvement on realistic workloads (most impactful when the model returns multiple tool calls and individual tools have high latency).
- If the gains are material, make it a standard option across SDKs.

---

## Appendix A: Full Type Definitions

```typescript
// --- Agent ---

interface AgentConfig<TInput = string, TOutput = string> {
  name: string;
  instructions: string;
  tools?: (ToolDefinition | ToolProvider)[];
  skills?: SkillDefinition[];                  // Stretch goal (§12.2)
  model?: string;                             // Deterministic model selection
  temperature?: number;                       // Generation temperature
  maxTokens?: number;                         // Max tokens in response
  reasoningEffort?: 'low' | 'medium' | 'high'; // Reasoning effort level
  inputSchema?: JsonSchema;                   // Plain JSON Schema (no Zod dependency)
  outputSchema?: JsonSchema;
  maxIterations?: number;                     // Default: 25
  parallelToolExecution?: boolean;            // Default: true
  hooks?: Hooks;
  experimental?: {
    earlyToolExecution?: boolean;             // Stretch goal (§12.8)
  };
  contextManagement?: ContextManagementConfig; // Stretch goal (§12.4)
  handoffs?: Agent[];                         // Stretch goal (§2.6)
}

interface RunOptions {
  model?: string;                             // Override model for this run
  temperature?: number;                       // Override temperature for this run
  maxTokens?: number;                         // Override max tokens for this run
  reasoningEffort?: 'low' | 'medium' | 'high'; // Override reasoning effort for this run
  maxIterations?: number;
  signal?: AbortSignal;
  parentSpanId?: string;
  context?: Record<string, unknown>;          // Passed to hooks and tool execute
}

// The return type of `await agent.run(input)`
interface RunResult<TOutput> {
  output: TOutput;
  usage: Usage;
  iterations: number;
  toolCalls: ToolCallRecord[];
  meta: ResponseMeta;
}

// The object returned by `agent.stream()` — AsyncIterable with result accessor
class AgentStream<TOutput> implements AsyncIterable<AgentStreamEvent<TOutput>> {
  [Symbol.asyncIterator](): AsyncIterator<AgentStreamEvent<TOutput>>;
  result(): Promise<RunResult<TOutput>>;     // Resolves when stream completes
}

// --- JSON Schema (no Zod dependency) ---

type JsonSchema = Record<string, unknown>;   // Standard JSON Schema object

// --- Tools ---

interface ToolConfig {
  name: string;
  description?: string;
  parameters: JsonSchema;                     // JSON Schema — the native format
  timeoutMs?: number;
  execute: (input: any, context?: ToolContext) => Promise<unknown> | unknown;
}

interface ToolDefinition {
  name: string;
  description?: string;
  parameters: JsonSchema;
  execute: (input: unknown, context?: ToolContext) => Promise<unknown>;
  timeoutMs?: number;
}

interface ToolContext {
  signal?: AbortSignal;
  agentName: string;
  iteration: number;
  runContext?: Record<string, unknown>;       // From RunOptions.context
}

interface ToolProvider {
  setup(): Promise<ToolDefinition[]>;
  teardown(): Promise<void>;
}

interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  iteration: number;
}

// --- Usage ---

interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  cost: number;
  llmCalls: number;
  breakdown?: Record<string, Usage>;          // Per sub-agent
}

// --- Hooks ---

interface Hooks {
  onAgentStart?:     (event: { input: unknown; context: Record<string, unknown> }) => void | Promise<void>;
  onAgentEnd?:       (event: { output: unknown; usage: Usage; error?: Error; context: Record<string, unknown> }) => void | Promise<void>;
  onIterationStart?: (event: { iteration: number; context: Record<string, unknown> }) => void | Promise<void>;
  onIterationEnd?:   (event: { iteration: number; usage: Usage; context: Record<string, unknown> }) => void | Promise<void>;
  onToolStart?:      (event: { toolName: string; input: unknown; context: Record<string, unknown> }) => void | Promise<void>;
  onToolEnd?:        (event: { toolName: string; result: unknown; error?: string; durationMs: number; context: Record<string, unknown> }) => void | Promise<void>;
  onLLMCall?:        (event: { iteration: number; messageCount: number; context: Record<string, unknown> }) => void | Promise<void>;
  onLLMResponse?:    (event: { iteration: number; usage: Usage; hasToolCalls: boolean; context: Record<string, unknown> }) => void | Promise<void>;
  onTextDelta?:      (event: { text: string; context: Record<string, unknown> }) => void | Promise<void>;
}

// --- Wire Protocol (SSE from /stream — internal, not exposed to users) ---

type ServerStreamEvent =
  | { type: 'content'; delta: string }
  | { type: 'tool_call_start'; tool_call_id: string; tool_call_name: string; tool_call_index: number }
  | { type: 'tool_call_delta'; tool_call_index: number; tool_call_args: string }  // JSON fragment
  | { type: 'done'; usage?: UsageInfo }
  | { type: 'error'; error: string };

// --- User-Facing Stream Events ---

type AgentStreamEvent<TOutput> =
  | { type: 'iteration_start'; iteration: number }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; toolName: string; toolCallId: string; input: unknown }  // Emitted after args fully accumulated
  | { type: 'tool_end'; toolName: string; result: unknown; error?: string; durationMs: number }
  | { type: 'iteration_end'; iteration: number; usage: Usage }
  | { type: 'result'; output: TOutput; usage: Usage }
  | { type: 'error'; error: Error };

// --- Messages (internal, sent to /run) ---

type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentBlock[] }
  | { role: 'assistant'; content?: string; tool_calls?: ToolCallMessage[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type ToolCallMessage = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

// --- Response from /run (JSON) ---

interface RunResponse {
  output: {
    content?: string;
    tool_calls?: ToolCallMessage[];
  };
  meta?: ResponseMeta;
}

// Note: /stream does NOT return a RunResponse. The SDK assembles
// the equivalent data from ServerStreamEvent events (content from
// text deltas, tool_calls from tool_call_start + tool_call_delta).

interface ResponseMeta {
  functionName?: string;
  modelsUsed?: string[];
  spanId?: string;                            // For trace propagation (asTool)
  contextUtilization?: number;                // 0-1, how full the context window is
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    reasoningTokens?: number;
  };
  cost?: number;
  executionMs?: number;
}

// --- Context Management (stretch goal) ---

interface ContextManagementConfig {
  strategy: 'summarize' | 'truncate' | 'sliding-window';
  maxContextTokens: number;
  keepLastN?: number;                         // Always keep last N messages
}
```
