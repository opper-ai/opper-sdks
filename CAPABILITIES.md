# Opper Agent SDK — Capabilities

> **Status:** Draft
> **Date:** 2026-03-27
> **Scope:** Language-agnostic specification for Opper Agent SDKs
> **Reference implementation:** [typescript/SPEC.md](./typescript/SPEC.md) (TypeScript/Node.js)
> **Agent transport:** The agent layer uses the **OpenResponses endpoint** (`POST /v3/compat/openresponses`) following the [Open Responses spec](https://www.openresponses.org). The SDK maintains the full items array client-side in OpenResponses format; Opper handles converting to provider-native formats.

This document describes **what** an Opper Agent SDK does and **why**, without prescribing implementation details for any specific language. It is the canonical entry point for building an Opper Agent SDK in any language.

> **Design decision: no hints.** This SDK is deterministic. Model selection, temperature, and other generation parameters are set explicitly — not through a hints/preferences bag. The API's `hints` field is excluded from the SDK surface.

---

## 1. Design Philosophy

### Thin Client, Smart Server

The SDK is an **API-complete client with an agent-first experience**. It exposes core Opper primitives directly through a base client, while providing a higher-level Agent abstraction optimized for ergonomics, composition, and production use.

For the agent layer, the SDK is a **thin orchestration layer**. All LLM complexity that benefits from centralization — model selection, prompt caching, native tool formats, token-efficient output — is handled server-side by the Task API. The SDK's job is:

1. Define agents and tools with good developer experience
2. Manage the agentic loop (call server, execute tools locally, call again)
3. Stream results to the user
4. Provide hooks for observability

### SDK-First Development Strategy

New features are prototyped client-side first. Once patterns prove stable and valuable, they graduate to server-side implementation for better performance, stronger guarantees, and cross-SDK consistency.

- The SDK is where we iterate fastest on developer ergonomics.
- The API is where proven concepts become platform capabilities.
- The long-term goal is to make successful SDK patterns part of the server contract where that improves reliability, performance, or interoperability.

### Two Layers

Every Opper Agent SDK has two layers:

1. **Base client** — a complete, low-level client that maps closely to the Opper API and exposes core primitives directly.
2. **Agent layer** — an opinionated, higher-level runtime built on the base client, focused on agent ergonomics.

The base client follows the platform closely and should feel predictable and explicit. The agent layer is free to be more ergonomic and opinionated. When API shape and ideal SDK ergonomics differ, the base client stays API-aligned while the Agent API can present a friendlier abstraction.

### Server Responsibilities (via Task API)

- Model selection and routing
- Native tool call format per provider (OpenAI, Anthropic, Google, etc.)
- Prompt caching (automatic, per provider)
- Script generation and caching
- Usage tracking and cost calculation
- Tracing and span creation

### SDK Responsibilities

- Low-level API access to Opper primitives
- Agent definition (instructions, tools, schemas)
- The agentic loop ("while tool_calls > 0")
- Local tool execution
- Streaming event dispatch
- Multi-agent composition
- Hooks and lifecycle events
- Context/conversation management across turns (SDK-first, server-side later)

---

## 2. Base Client Layer

The base client provides API-complete access to Opper primitives. Each SDK should expose a client that maps directly to the Opper API.

### Core Operations

```
client = Opper(api_key, base_url)       // or from environment variables

// Task execution
response = client.call(name, request)
events   = client.stream(name, request)

// Knowledge base operations
kb       = client.knowledge.create(name, embedding_model)
results  = client.knowledge.query(kb_id, query, options)

// Tracing
result   = client.traced(name, fn)
```

### Authentication

- **API key**: from environment variable (`OPPER_API_KEY`) or passed explicitly
- **Base URL**: from environment variable (`OPPER_BASE_URL`) or defaults to `https://api.opper.ai`

### 2.1 Schema Support

JSON Schema is the native wire format for all schema fields across the SDK: `input_schema`, `output_schema`, and `Tool.parameters`.

| Language | Native | Schema Library Support |
|---|---|---|
| TypeScript | JSON Schema | **Standard Schema V1** — Zod v4, Valibot, ArkType, etc. accepted directly. Also `jsonSchema<T>()` wrapper for type inference with raw schemas. |
| Python | JSON Schema | `from_pydantic()`, `from_dataclass()` adapters |
| Go | JSON Schema | Struct tags, code generation |

For TypeScript, the SDK detects **Standard Schema V1** at runtime (any object with a `~standard` property) and resolves it to JSON Schema automatically. No explicit adapter imports are needed. For Zod v4, the SDK uses Zod's native `toJSONSchema()`.

Schema objects are usable anywhere — not tied to a specific layer:

- **Agent schemas:** `input_schema` / `output_schema` on agent definitions
- **Tool parameters:** `parameters` on tool definitions
- **Base client calls:** `input_schema` / `output_schema` passed directly to `client.call()`

**Zero required dependencies.** The SDK itself does not depend on any schema library. Users bring their own.

### Design Note

The base client's full API surface — every endpoint, request/response shape, streaming wire protocol, and error model — is specified in [BASE_CLIENT_SPEC.md](./BASE_CLIENT_SPEC.md). The agent layer (sections 3-12) is the primary focus of this document.

---

## 3. Agent Definition

An agent is configured with a name, instructions, tools, and optional settings.

```
agent = Agent(
  name:           "analytics-assistant",
  instructions:   "You help users understand their product metrics.",
  tools:          [getActivationRate, queryDatabase],

  // Optional
  model:          "anthropic/claude-sonnet-4-6",   // Deterministic model selection
  input_schema:   { JSON Schema },                  // Validates and types the input
  output_schema:  { JSON Schema },                  // Validates and types the output
  temperature:    0.7,                               // Generation temperature
  max_tokens:     4096,                              // Max output tokens
  max_iterations: 10,                               // Default: 25
  hooks:          { on_tool_start, on_tool_end },   // Lifecycle hooks
)
```

### Design Decisions

- **Single `instructions` field.** Replaces any split of "description" + "instructions". One field, one purpose: tell the model what this agent does and how.
- **`model` is deterministic.** When set, this exact model is used. When omitted, the server picks its own default.
- **JSON Schema is the native schema format.** Schemas are plain JSON Schema objects — the native wire format. This avoids dependency on any specific schema library and works across all languages.
- **`input_schema` / `output_schema` are optional.** When provided, the SDK sends them to the server (via `text.format` for output) for enforcement, and optionally validates locally.
- **No built-in memory.** If users need persistence, they use tools (e.g., read/write tools backed by Opper indexes or any store). This is simpler, more flexible, and doesn't pollute every LLM call.

---

## 4. Tool System

### Tool Definition

A tool is defined with a name, description, JSON Schema parameters, and an execute function.

```
metric_tool = tool(
  name:        "get_metric",
  description: "Fetch a product metric by name",
  parameters:  {
    type: "object",
    properties: {
      metric: { type: "string", description: "Metric name" },
      period: { type: "string", enum: ["7d", "30d", "90d"] }
    },
    required: ["metric"]
  },
  execute: (input) => {
    value = analytics_db.get_metric(input.metric, input.period)
    return { metric: input.metric, value: value }
  }
)
```

### Design Decisions

- **Follows the industry standard pattern**: `tool(name, description, parameters, execute)`. Used by OpenAI, Vercel AI SDK, and others.
- **`parameters` is a JSON Schema object** — the native wire format. No conversion needed at the wire level.
- **`execute` receives parsed input.** The return value is automatically serialized to JSON by the SDK.
- **No result wrapping.** Just return the value or throw an error. The SDK wraps it into the appropriate format.
- **No output schema on tools.** The server doesn't need it and it was mostly unused in practice.

### Schema Adapters for Tools

Tool `parameters` accepts plain JSON Schema (or Standard Schema in TypeScript). Schema library support (§2.1) works here — Standard Schema objects are resolved automatically, and Python adapters (`from_pydantic()`, etc.) produce the JSON Schema object that `parameters` expects. See §2.1 for the full table and design rationale.

### Idiomatic Tool Definition

Each language SDK should use its most idiomatic pattern for defining tools:

- **TypeScript**: `tool()` function (decorators dropped — they require config flags and have version compatibility issues)
- **Python**: `@tool` decorator (Python decorators are stable and idiomatic)
- **Go**: Struct implementing a Tool interface, or functional options

The underlying capability is the same: name, description, parameters, execute.

### Tool Providers (MCP)

The SDK supports external tool sources via the Model Context Protocol:

```
agent = Agent(
  name: "file-assistant",
  tools: [
    mcp(command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"])
  ]
)
```

A tool provider is an object with:
- `setup()` → discovers and returns tool definitions
- `teardown()` → cleans up resources

The SDK calls `setup()` before the first run and `teardown()` after. Tools from MCP servers are converted to the SDK's standard tool format and prefixed: `mcp__<server>__<toolname>`.

Supported transports: stdio, SSE, HTTP.

### Parallel Execution

Tools execute **in parallel by default**. When a model returns multiple tool calls in a single response, they all run concurrently. SDKs should provide an option to switch to sequential execution if needed.

### Timeouts

Individual tools can specify a timeout. If the tool execution exceeds this duration, it is treated as a tool error (fed back to the model, not thrown).

---

## 5. Running an Agent

### Two Explicit Methods

Every SDK exposes two ways to run an agent:

| Method | Returns | Transport | Use case |
|---|---|---|---|
| `run(input)` | Final result | POST `/v3/compat/openresponses` (`stream: false`) | Get the answer, ignore intermediate steps |
| `stream(input)` | Event iterator | POST `/v3/compat/openresponses` (`stream: true`) | Observe events as the agent works |

```
// Run — get the final result
result = agent.run("What is our activation rate?")
print(result.output)   // "Your activation rate is 34.2%"
print(result.usage)    // { input_tokens: 850, output_tokens: 120, cost: 0.003 }

// Stream — observe events
for event in agent.stream("What is our activation rate?"):
  if event.type == "text_delta":
    print(event.text)
  if event.type == "tool_start":
    print("Calling " + event.tool_name + "...")
```

### Why Two Methods

| Approach | Trade-off |
|---|---|
| **Two methods**: `run()` / `stream()` | Explicit, simple types, easy to teach |
| **One method, parameter**: `run(input, stream=true)` | Awkward overloads, return type depends on runtime boolean |
| **Dual-interface object** (Promise + Iterator) | Clever but fragile: edge cases around cancellation, single-consumption |

We chose two explicit methods because:
1. **Obvious.** `run()` returns a result. `stream()` returns events. No surprises.
2. **Simple types.** Each method has one clear return type. No overloads, no dual interfaces.
3. **Reliable transport.** `run()` uses POST — no SSE failure modes. `stream()` uses SSE — only when needed.
4. **Easy to teach.** Start with `run()`. When you need streaming, switch to `stream()`.
5. **Cross-language.** Every language has clear equivalents for "call and wait" vs "iterate events."

### Run Options

Both methods accept per-run overrides:

```
result = agent.run("question", {
  model:          "anthropic/claude-sonnet-4-6",   // Override model
  temperature:    0.2,                              // Override temperature
  max_iterations: 5,                                // Override iteration limit
  signal:         abort_controller.signal,           // Cancellation
  parent_span_id: "span-123",                       // Trace propagation
})
```

### Run Result

The result of `run()` (and `stream().result()`) contains:

| Field | Description |
|---|---|
| `output` | The final output (validated against output_schema if provided) |
| `usage` | Aggregated token usage across all iterations |
| `iterations` | How many loop iterations were needed |
| `tool_calls` | Full log of all tool calls made |
| `meta` | Server metadata (models used, cost, cache stats) |

---

## 6. The Agentic Loop

The loop is the same for both `run()` and `stream()`. The only difference is `stream: false` vs `stream: true` in the request and whether events are yielded to the caller. Both use the **OpenResponses endpoint** (`POST /v3/compat/openresponses`).

### OpenResponses Item Format

Instead of chat messages, the agent layer uses **OpenResponses items**:

| Concept | OpenResponses Format |
|---|---|
| User input | `{ type: "message", role: "user", content: "..." }` |
| System instructions | Top-level `instructions` field (not an item) |
| Tool definitions | `tools: [{ type: "function", name, description, parameters }]` |
| Tool call (from model) | Output item: `{ type: "function_call", call_id, name, arguments }` |
| Tool result (to model) | Input item: `{ type: "function_call_output", call_id, output }` |
| Assistant text | Output item: `{ type: "message", role: "assistant", content: [{type: "output_text", text}] }` |
| Structured output | `text: { format: { type: "json_schema", name, schema } }` |

### Loop Steps

```
function execute(agent, input, options):
  1. Setup: resolve tool providers (MCP setup, skill loading)
  2. Build initial items:
     [{ type: "message", role: "user", content: input }]
  3. Fire hook: on_agent_start

  4. LOOP (iteration = 1..max_iterations):

     a. Fire hooks: on_iteration_start, on_llm_call

     b. Call server:
        POST /v3/compat/openresponses
        Body: {
          input: items,                    // full accumulated items array
          instructions: agent.instructions,
          model, tools, temperature, max_output_tokens,
          stream: false (run) / true (stream),
          text: output_schema ? { format: { type: "json_schema", ... } } : undefined,
          reasoning: reasoning_effort ? { effort } : undefined,
        }

     c. Consume response:
        - run mode:    parse ORResponse JSON, extract output items
        - stream mode: consume OpenResponses SSE events, yield text_delta events,
                       accumulate full response before proceeding

     d. Fire hook: on_llm_response

     e. Append ALL output items to items array
        (assistant messages, function_call items, reasoning items)

     f. If NO function_call items in output → DONE
        - Extract text from message output items
        - Validate output against output_schema if provided
        - Fire hook: on_agent_end
        - Return result

     g. Execute tools locally (parallel by default):
        For each function_call item:
          - Fire hook: on_tool_start
          - Find tool by name, JSON.parse(arguments), call execute(parsed_args)
          - Fire hook: on_tool_end
          - On error: serialize error as tool result (don't throw)

     h. Append function_call_output items to items array:
        [{ type: "function_call_output", call_id, output: JSON.stringify(result) }, ...]

     i. Fire hook: on_iteration_end
     j. Continue loop

  5. If max_iterations reached → error with partial result
  6. Teardown: tool provider cleanup
```

### Tool Call Assembly

In stream mode, the SDK accumulates tool call arguments from `response.function_call_arguments.delta` SSE events. This is trivial: concatenate argument fragments per `call_id`, then use the complete string from `response.function_call_arguments.done`. Tool execution begins only after **all tool calls** in the response are fully received (after `response.completed`).

**No early tool execution in v1.** The SDK does not start executing tools from partial stream data. Early execution can be added as an opt-in experiment later if latency data justifies it.

### Tool Call Contract

The server exposes function_call items in the OpenResponses output:

- **Sync mode (`stream: false`):** Each function_call output item has a `call_id`, `name`, and `arguments` (JSON string).
- **Streaming mode (`stream: true`):** Function call arguments are delivered incrementally via `response.function_call_arguments.delta` events, completed by `response.function_call_arguments.done`.
- The SDK treats the `call_id` as opaque — only used to correlate tool results via `function_call_output` items.
- If a provider doesn't supply a usable ID, the server generates one.

This keeps provider quirks on the server side.

### Why This Beats V1

| Concern | V1 | V2 |
|---|---|---|
| LLM call format | Custom JSON with embedded tools/history/instructions | OpenResponses items, server converts per provider |
| Tool definitions | Embedded in prompt text | First-class `tools` parameter, server converts to native format |
| Prompt caching | Not possible | Server applies cache breakpoints; stable prefix is cached |
| Output format | Custom decision schema | Native `function_call` output items |
| System prompt | ~450 tokens of scaffolding per call | Agent instructions only |
| Token overhead | ~5,000+ extra tokens per run | Minimal — only the actual conversation |
| Model compatibility | Depends on model understanding custom schema | Any model with tool calling support |
| Wire protocol | Custom `/call` + `/stream` | Standard OpenResponses format, multi-provider compatible |

---

## 7. Streaming

### Wire Protocol (OpenResponses SSE)

The OpenResponses endpoint with `stream: true` emits discrete SSE events with named event types. The server proxies incremental data from the upstream LLM provider in the OpenResponses format.

| SSE event type | Key fields | Description |
|---|---|---|
| `response.created` | `response` | Response created |
| `response.in_progress` | `response` | Processing started |
| `response.completed` | `response` (full ORResponse) | Response complete — includes output items and usage |
| `response.output_item.added` | `output_index`, `item` | New output item started |
| `response.output_item.done` | `output_index`, `item` | Output item complete |
| `response.output_text.delta` | `output_index`, `delta` | Incremental text from the model |
| `response.output_text.done` | `output_index`, `text` | Complete text for output |
| `response.function_call_arguments.delta` | `output_index`, `call_id`, `delta` | Incremental tool call arguments (JSON fragment) |
| `response.function_call_arguments.done` | `output_index`, `call_id`, `arguments` | Complete tool call arguments |
| `error` | `error` (code, message) | Server-side error |

This follows the OpenResponses spec which is supported by multiple providers. The SDK accumulates tool call arguments from delta events internally and extracts the complete response from the `response.completed` event.

### SDK-Level Events (User-Facing)

The SDK consumes the wire protocol internally and exposes a **higher-level event stream** to users. Users never see raw `function_call_arguments.delta` events — the SDK accumulates tool call arguments internally and emits only complete, actionable events.

| Event | Fields | When |
|---|---|---|
| `iteration_start` | iteration number | Beginning of each loop iteration |
| `text_delta` | text chunk | Incremental text from model (from `response.output_text.delta` events) |
| `tool_start` | tool name, call_id, input | Tool call fully received, about to execute locally |
| `tool_end` | tool name, result, error, duration | After local tool execution completes |
| `iteration_end` | iteration number, usage | End of each loop iteration |
| `result` | output, usage | Final result |
| `error` | error | Unrecoverable error |

**Two layers:** The raw OpenResponses SSE events are accumulated internally. Users see clean high-level events. This keeps the wire protocol efficient and the user API simple.

### Stream with Result

The stream object supports iterating events **and** accessing the final result:

```
stream = agent.stream("What is our activation rate?")

for event in stream:
  // observe events, show progress, log...

result = stream.result()   // already resolved since iteration completed
```

This pattern lets callers consume events for UI/logging while still accessing the structured result at the end.

---

## 8. Multi-Agent Composition

### Agent as Tool (Primary Pattern)

Any agent can be wrapped as a tool for another agent:

```
researcher = Agent(name: "researcher", instructions: "...", tools: [web_search])
writer     = Agent(name: "writer", instructions: "...", tools: [
  researcher.as_tool("research", "Research a topic and return findings")
])

result = writer.run("Write a report on AI agent frameworks")
```

- `as_tool(name, description)` wraps the agent as a tool. When called, it runs the sub-agent to completion and returns its output.
- Usage from sub-agents is tracked in the parent's result with a breakdown by agent name.
- Sub-agent iterations are independent — they don't count against the parent's limit.

### Handoffs (Stretch Goal)

Inspired by OpenAI's pattern. An agent can transfer control to another agent:

```
triage = Agent(
  name: "triage",
  instructions: "Route the user to the right specialist.",
  handoffs: [billing_agent, technical_agent]
)
```

- Handoff agents appear as tools to the model (e.g., `transfer_to_billing`)
- When triggered, the current agent stops and the target takes over with full conversation context
- The final result comes from whichever agent finishes

### Trace Propagation

When a sub-agent runs via `as_tool()`, the parent's span ID flows as `parent_span_id` to the child. The server creates nested spans. The SDK aggregates usage across all sub-agents in the result.

---

## 9. Hooks & Observability

### Hook Points

| Hook | Fires when | Payload |
|---|---|---|
| `on_agent_start` | Run begins | input, context |
| `on_agent_end` | Run completes | output, usage, error, context |
| `on_iteration_start` | Loop iteration begins | iteration, context |
| `on_iteration_end` | Loop iteration ends | iteration, usage, context |
| `on_tool_start` | Before tool execution | tool name, input, context |
| `on_tool_end` | After tool execution | tool name, result, error, duration, context |
| `on_llm_call` | Before server call | iteration, message count, context |
| `on_llm_response` | After server response | iteration, usage, has_tool_calls, context |
| `on_text_delta` | Incremental text received | text, context |

### Design Decisions

- **Declarative.** Hooks are set in the agent constructor, not via event emitter patterns. Simpler, more discoverable.
- **Mutable context.** Every hook receives a shared `context` bag that the user can use to track custom state across the run.
- **Sync or async.** The SDK awaits hooks, so they can be either.
- **Fires in both modes.** Hooks fire regardless of whether `run()` or `stream()` is used.
- **~10 hooks maximum.** More than that becomes excessive and hard to maintain.

---

## 10. Configuration

### Model Selection

`model` is a top-level, optional, deterministic field. When set, this exact model is used. When omitted, the server picks its own default.

### Generation Parameters

Generation parameters are set explicitly as top-level fields on the agent or per-run:

| Parameter | Type | Description |
|---|---|---|
| `model` | string | Deterministic model selection (e.g. `"anthropic/claude-sonnet-4-6"`) |
| `temperature` | number | 0.0 - 2.0 |
| `max_tokens` | number | Max output tokens |
| `reasoning_effort` | string | `"low"` / `"medium"` / `"high"` |

### Client Setup

```
// From environment (OPPER_API_KEY, OPPER_BASE_URL)
client = Opper()

// Explicit
client = Opper(api_key: "op-...", base_url: "https://api.opper.ai")

// Agent from client
agent = client.agent(name: "...", instructions: "...", tools: [...])

// Standalone agent (uses OPPER_API_KEY env var)
agent = Agent(name: "...", instructions: "...", tools: [...])
```

---

## 11. Error Model

### Tool Errors Are Not Fatal

When a tool's execute function throws an error, the SDK does **not** propagate it. Instead, the error message is serialized and sent back to the model as a tool result. The model can then retry, try a different approach, or report the error to the user.

### SDK Errors

These are thrown/raised to the caller:

| Error | When | Contains |
|---|---|---|
| `MaxIterationsError` | Agent hit iteration limit without completing | Partial output, iteration count, tool call log |
| `AbortError` | Run was cancelled via signal | — |
| `AgentError` | Server error, network error, unexpected failure | Error details |

---

## 12. Conversation / Multi-Turn

### Direct Items

For full control, pass an items array directly (OpenResponses format):

```
result = agent.run({
  items: [
    { type: "message", role: "user", content: "My name is Alice" },
    { type: "message", role: "assistant", content: [{type: "output_text", text: "Nice to meet you, Alice!"}] },
    { type: "message", role: "user", content: "What is my name?" },
  ]
})
```

### Conversation Helper

A stateful wrapper that tracks items across turns:

```
conversation = agent.conversation()

r1 = conversation.send("My name is Alice")
r2 = conversation.send("What is my name?")
// r2.output → "Your name is Alice"
```

The conversation helper:
- Maintains the items array across `send()` calls in OpenResponses format
- Appends assistant output items and user message items each turn
- Handles tool calls (function_call + function_call_output items) transparently within each turn
- **Does not persist across process restarts** — it is in-memory only

---

## 13. Server Contract

The agent layer depends on the **OpenResponses endpoint** (`POST /v3/compat/openresponses`).

### Required

1. **OpenResponses endpoint with sync and streaming modes.** `stream: false` returns ORResponse JSON. `stream: true` returns SSE events in the OpenResponses event format. Both accept the same ORRequest shape.

2. **OpenResponses items format.** The API accepts items (messages, function_call, function_call_output) as input in OpenResponses format. The server translates to provider-native formats. Instructions are provided via the top-level `instructions` field.

3. **First-class tool definitions.** Tools are passed as `tools: [{ type: "function", name, description, parameters }]`. The server converts to provider-native formats.

4. **Function call items in responses.** When the model wants to call tools, the output includes `function_call` items with a `call_id`, `name`, and `arguments` (JSON string). If the provider doesn't supply a usable ID, the server generates one.

5. **Tool results round-trip via function_call_output items.** The API accepts `function_call_output` input items referencing the original `call_id`. The server preserves the association when translating to provider-native formats.

6. **Streaming follows OpenResponses event types.** `response.output_text.delta` for text, `response.function_call_arguments.delta`/`.done` for tool call arguments, `response.completed` with the full ORResponse including usage. The SDK assembles the complete response from discrete events.

7. **Usage and tracing per call.** Every response includes `usage`. Opper extension items may include cost, execution time, models used, cache stats. The server owns authoritative usage, cost, and span creation.

8. **Model selection: explicit.** If `model` is provided, the server uses it deterministically. If omitted, the server uses its own default.

9. **Structured output via text.format.** The API supports `text: { format: { type: "json_schema", name, schema } }`.

### Stability Properties

1. **Mode parity.** `stream: false` and `stream: true` must not diverge in accepted input or final response semantics.
2. **Provider abstraction.** Provider-specific details stay server-side. The SDK sends OpenResponses items; the server converts.
3. **Forward compatibility.** OpenResponses item and tool formats must be stable enough for SDKs in multiple languages.
4. **Server authority.** Usage, cost, and tracing are owned by the server.

### What Stays SDK-First for Now

These evolve in the SDK before being locked into the API:
- Conversation helpers and multi-turn convenience APIs
- Context management and context-window strategies
- Memory patterns built on tools and knowledge/index primitives
- Skills loading and composition
- Agent handoffs and multi-agent coordination
- Client ergonomics (retries, batching, helpers)

### Nice-to-Haves

1. Automatic cache segmentation for stable prefixes
2. Usage breakdown: `cache_read_tokens`, `cache_creation_tokens`, richer cost metadata
3. Server-side safety limits (e.g., `max_llm_calls`) to guard against buggy clients
4. Conversation identifiers for cache reuse or future server-managed conversations

### Explicit Non-Goals for V2

- Server-side execution of the full agentic loop
- Early/speculative tool execution from partial stream data (tool call deltas are streamed, but execution waits for completion)
- Server-managed memory as mandatory for every agent call
- Locking advanced SDK experiments into the API prematurely

---

## 14. Roadmap / Stretch Capabilities

### Usage, Cache, Cost Overview

Surface rich metadata from the server in the run result: input/output/cache tokens, cost, LLM call count, per-sub-agent breakdown, context utilization.

### Skills (Progressive Disclosure)

Skills are reusable agent capabilities (from [skills.sh](https://skills.sh)). Unlike tools, skills use **progressive disclosure**: the model initially sees only compact front matter, and deeper sections are revealed on demand. A skill may disclose tools, examples, workflows, or instructions over time.

**SDK-first.** Skills are loaded from the local filesystem. Once the disclosure pattern is stable, the API could support first-class skill references.

### Agent Deploy

Deploy an agent to Opper as a hosted service. Preferred approach: container-based (agent + tools packaged as a Docker container, deployed to Opper infrastructure). Alternative: webhook-based (agent config on Opper, tool execution via webhooks to user's service).

### Context Management

Prevent context window overflow in long-running agents. Strategies: summarize (extra LLM call to compress old messages), truncate (drop oldest messages), sliding window (fixed recent window).

**SDK-first**, then migrate to server-side once patterns are proven (server can apply provider-specific optimizations like Anthropic's compact API).

### Built-In Tools (Server-Side)

Opper-managed tools that execute server-side: semantic search over Opper indexes, web search, code interpreter. The SDK provides helpers that return tool definitions where `execute` calls the Opper API.

### Memory via Opper Indexes

Persistent memory backed by Opper's vector search indexes. Implemented as a tool, not a special system. The agent uses read/write/search operations as tool calls, backed by Opper indexes.

### Forced Reasoning

For models without native reasoning support, the server can inject chain-of-thought prompting. The SDK sends `reasoning_effort`, and the server decides whether to use native reasoning or prompt-based reasoning.

### Early Tool Execution from Streaming

Start tool execution before all tool calls in a response are fully received. The wire protocol already streams `tool_call_start` (with tool name) and `tool_call_delta` (with argument fragments), so the SDK could begin execution as soon as a single tool call's arguments are complete — without waiting for other tool calls to finish streaming. Stretch goal behind an explicit opt-in flag. The main complexity is handling cancellation and error recovery if a later tool call invalidates an earlier one.
