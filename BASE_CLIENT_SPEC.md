# Base Client Specification

> **Status:** Draft
> **Date:** 2026-03-11
> **Scope:** Language-agnostic specification for the Opper Task API base client layer

This document specifies the **base client** — the low-level, API-complete typed wrapper around the Opper Task API. It covers every endpoint, request/response shape, and streaming wire protocol.

The base client is layer 1 of every Opper SDK. The agent layer ([CAPABILITIES.md](./CAPABILITIES.md) §3+) builds on top of it.

> **Design decision: no hints.** This SDK is deterministic. Model selection, temperature, and other generation parameters are set explicitly per-request — not through a hints/preferences bag. The `hints` field exists in the API but is excluded from the SDK surface.

---

## 1. Design Principles

- **API-aligned.** Method names and types mirror the API. No surprises.
- **Zero runtime dependencies.** Only the language's standard library + HTTP client.
- **Typed request/response for every endpoint.** Every call has explicit input and output types.
- **Streaming as first-class.** SSE streaming returns an async iterable / async generator, not callbacks.
- **Provider-agnostic.** Compat endpoints expose provider formats as-is — the base client wraps without translation.

---

## 1.1 Schema Adapters

JSON Schema is the wire format for `input_schema`, `output_schema`, and `Tool.parameters`. The SDK provides **optional adapters** for popular schema libraries that convert to JSON Schema:

```
fromZod(ZodSchema)       → JSON Schema object
from_pydantic(Model)     → JSON Schema object
```

Adapters are **pure converters** — they take a schema definition in a third-party library's format and return a plain JSON Schema object. The result is usable anywhere the base client accepts a schema: `input_schema`, `output_schema`, or `Tool.parameters`.

**Zero required dependencies.** The SDK itself does not depend on any schema library. Users bring their own (Zod, Pydantic, TypeBox, etc.) and import the corresponding adapter.

**Not layer-specific.** The same adapter output works at any SDK layer — base client calls, agent definitions, or tool parameters. The adapter doesn't know or care which layer consumes the result.

```typescript
import { Opper } from '@opperai/agents';
import { fromZod } from '@opperai/agents/schema/zod';
import { z } from 'zod';

const InputSchema = z.object({ question: z.string() });
const OutputSchema = z.object({ answer: z.string(), confidence: z.number() });

const client = new Opper();
const response = await client.functions.run('my-fn', {
  input_schema: fromZod(InputSchema),
  output_schema: fromZod(OutputSchema),
  input: { question: 'What is our activation rate?' },
});
```

See [CAPABILITIES.md §2.1](./CAPABILITIES.md) for the language-agnostic adapter table and [typescript/SPEC.md §2.2](./typescript/SPEC.md) for TypeScript-specific adapter examples across all layers.

---

## 2. Configuration

### Client Construction

```
client = Opper(api_key, base_url?, headers?)
```

| Parameter | Type | Default | Env Var |
|---|---|---|---|
| `api_key` | string (required) | — | `OPPER_API_KEY` |
| `base_url` | string | `https://api.opper.ai` | `OPPER_BASE_URL` |
| `headers` | map<string, string> | `{}` | — |

If `api_key` is not provided explicitly, the client reads from `OPPER_API_KEY`. If neither is set, construction fails with a clear error.

### Per-Request Options

Every method accepts an optional `RequestOptions`:

```
RequestOptions {
  headers?:  map<string, string>   // merged with client headers
  signal?:   AbortSignal           // cancellation
  timeout?:  number                // ms, overrides client default
}
```

### Authentication

All requests (except `/health` and `/models`) include:
```
Authorization: Bearer <api_key>
```

---

## 3. Endpoint Map

All paths are relative to `base_url`. The API version prefix (`/v3/`) is part of the path for core endpoints. Compat endpoints use their own prefixes.

```
CORE (Functions)
  POST   /v3/functions/{name}/run                Execute function
  POST   /v3/functions/{name}/stream             Execute function (SSE)
  GET    /v3/functions                           List functions
  GET    /v3/functions/{name}                    Get function details
  PUT    /v3/functions/{name}                    Update function source
  DELETE /v3/functions/{name}                    Delete function
  POST   /v3/functions/{name}/realtime           Create voice agent
  GET    /v3/functions/{name}/revisions          List revisions
  GET    /v3/functions/{name}/revisions/{id}     Get revision
  POST   /v3/functions/{name}/revisions/{id}/revert  Revert to revision

CORE (Examples)
  POST   /v3/functions/{name}/examples           Create example
  POST   /v3/functions/{name}/examples/batch     Batch create examples
  GET    /v3/functions/{name}/examples           List examples
  DELETE /v3/functions/{name}/examples/{uuid}    Delete example

OBSERVABILITY
  POST   /v3/spans                               Create span
  PATCH  /v3/spans/{id}                          Update span
  GET    /v3/generations                         List generations
  GET    /v3/generations/{id}                    Get generation
  DELETE /v3/generations/{id}                    Delete generation

COMPATIBILITY
  POST   /v3/compat/chat/completions             OpenAI Chat (SSE)
  POST   /v3/compat/responses                    OpenAI Responses (SSE)
  POST   /v3/compat/v1beta/interactions          Google Interactions (SSE)
  POST   /v3/compat/v1/messages                  Anthropic Messages (SSE)
  POST   /v3/compat/embeddings                   OpenAI Embeddings

UTILITY
  GET    /v3/models                              List models (no auth)
  POST   /v3/parse                               Parse Starlark script
  GET    /health                                 Health check (no auth)
  WS     /v3/realtime/{name}                     WebSocket voice agent
```

---

## 4. Core Execution Endpoints (Primary Focus)

These are the two most important endpoints. Every agent interaction flows through `/run` or `/stream`.

### 4.1 `POST /v3/functions/{name}/run`

Synchronous execution. Sends input, receives complete output.

#### Request: `RunRequest`

```
RunRequest {
  input_schema:    object          // JSON Schema describing the input shape
  output_schema:   object          // JSON Schema describing the desired output shape
  input:           object          // The actual input data (conforming to input_schema)
  model?:          string          // Deterministic model selection (e.g. "anthropic/claude-sonnet-4-6")
  temperature?:    number          // 0.0 - 2.0
  max_tokens?:     number          // Max output tokens
  reasoning_effort?: string        // "low" | "medium" | "high"
  parent_span_id?: string          // Trace propagation — links this call to a parent span
  tools?:          Tool[]          // Tool definitions the model may call
}
```

#### Response: `RunResponse`

```
RunResponse {
  output:   any                    // The function output (conforming to output_schema)
  meta?:    ResponseMeta           // Execution metadata
}
```

#### `Tool`

```
Tool {
  name:         string                    // Tool name
  description?: string                    // What the tool does
  parameters:   object                    // JSON Schema for tool parameters
}
```

#### `ResponseMeta`

```
ResponseMeta {
  function_name:    string          // Name of the function that was executed
  script_cached:    boolean         // Whether the script was served from cache
  execution_ms:     number          // Total execution time in milliseconds
  llm_calls:        number          // Number of LLM calls made
  tts_calls:        number          // Number of TTS calls made
  image_gen_calls:  number          // Number of image generation calls made
  generation_ms?:   number          // LLM generation time in milliseconds
  cost?:            number          // Estimated cost in USD
  usage?:           UsageInfo       // Token usage breakdown
  models_used?:     string[]        // Models used during execution
  model_warnings?:  string[]        // Warnings about model selection/fallback
}
```

#### `UsageInfo`

```
UsageInfo {
  input_tokens:            number   // Input tokens consumed
  output_tokens:           number   // Output tokens generated
  reasoning_tokens?:       number   // Reasoning/thinking tokens (OpenAI o-series, Anthropic extended thinking)
  cache_read_tokens?:      number   // Tokens read from prompt cache
  cache_creation_tokens?:  number   // Tokens written to cache (5m TTL)
  cache_creation_1h_tokens?: number // Tokens written to cache (1h TTL)
  input_audio_tokens?:     number   // Audio input tokens (OpenAI audio models)
  output_audio_tokens?:    number   // Audio output tokens (OpenAI audio models)
}
```

---

### 4.2 `POST /v3/functions/{name}/stream`

SSE streaming execution. Same request shape as `/run`, but returns a stream of Server-Sent Events.

#### Request

Same `RunRequest` as `/run`.

#### Wire Protocol: `StreamChunk`

Each SSE event is a JSON-encoded `StreamChunk`. This matches the Go `provider.StreamChunk` struct exactly:

```
StreamChunk {
  type:                    string      // "content" | "tool_call_start" | "tool_call_delta" | "done" | "error"
  delta:                   string      // Text content (when type="content")
  error:                   string      // Error message (when type="error")
  tool_call_index:         number      // Parallel tool call index (0-based)
  tool_call_id:            string      // Unique tool call ID (in tool_call_start)
  tool_call_name:          string      // Function name (in tool_call_start)
  tool_call_args:          string      // Incremental JSON arguments (in tool_call_delta)
  tool_call_thought_sig:   string      // Gemini-specific thought signature for multi-turn
  usage:                   UsageInfo   // Token usage (in final "done" chunk)
}
```

#### SSE Wire Format

```
data: {"type":"content","delta":"Hello"}\n\n
data: {"type":"content","delta":" world"}\n\n
data: {"type":"tool_call_start","tool_call_index":0,"tool_call_id":"call_123","tool_call_name":"get_metric"}\n\n
data: {"type":"tool_call_delta","tool_call_index":0,"tool_call_args":"{\"metric\":"}\n\n
data: {"type":"tool_call_delta","tool_call_index":0,"tool_call_args":"\"dau\"}"}\n\n
data: {"type":"done","usage":{"input_tokens":100,"output_tokens":50}}\n\n
data: [DONE]\n\n
```

- Each line is prefixed with `data: `
- Events are separated by `\n\n`
- Stream terminates with `data: [DONE]`
- All JSON fields use `snake_case`

#### Chunk Types

| Type | Key Fields | Description |
|---|---|---|
| `content` | `delta` | Incremental text from the model |
| `tool_call_start` | `tool_call_id`, `tool_call_name`, `tool_call_index` | New tool call — name and ID known immediately |
| `tool_call_delta` | `tool_call_index`, `tool_call_args` | Incremental JSON arguments for a tool call |
| `done` | `usage` | Stream complete — final usage metadata |
| `error` | `error` | Server-side error |

#### Client-Side Handling

The client exposes the stream as `AsyncGenerator<StreamChunk>` / async iterable:

```
stream = client.functions.stream(name, request)
for chunk in stream:
  if chunk.type == "content":
    print(chunk.delta)
  elif chunk.type == "done":
    print(chunk.usage)
```

**SSE parsing:** Read lines from the response body. For each line starting with `data: `, strip the prefix. If the remainder is `[DONE]`, close the stream. Otherwise, JSON-parse it as a `StreamChunk` and yield.

**Abort/cancellation:** The client passes the `AbortSignal` to the underlying HTTP request. On abort, the connection is closed and the async iterator terminates.

---

## 5. Function Management Endpoints

### 5.1 `GET /v3/functions` — List Functions

Returns all cached functions for the authenticated project.

**Response:**
```
{ functions: FunctionInfo[] }

FunctionInfo {
  name:          string
  schema_hash:   string
  generated_at:  string          // ISO 8601 timestamp
  hit_count:     number
  has_script:    boolean
}
```

### 5.2 `GET /v3/functions/{name}` — Get Function

Returns function details including script source and schemas.

**Response: `FunctionDetails`**
```
FunctionDetails {
  name:           string
  schema_hash:    string
  generated_at:   string
  hit_count:      number
  source:         string          // Starlark script source code
  input_schema:   object          // JSON Schema
  output_schema:  object          // JSON Schema
}
```

### 5.3 `PUT /v3/functions/{name}` — Update Function

Updates the source code of a function.

**Request: `UpdateFunctionRequest`**
```
UpdateFunctionRequest {
  source: string                  // New Starlark script source
}
```

**Response:** `FunctionDetails`

### 5.4 `DELETE /v3/functions/{name}` — Delete Function

Deletes a cached function. Returns `204 No Content`.

### 5.5 `POST /v3/functions/{name}/realtime` — Create Realtime Function

Generates a realtime voice agent function.

**Request: `RealtimeCreateRequest`**
```
RealtimeCreateRequest {
  name:       string
  script:     string
  cached:     boolean
  reasoning?: string
}
```

**Response: `RealtimeCreateResponse`**
```
RealtimeCreateResponse {
  name:       string
  script:     string
  cached:     boolean
  reasoning?: string
}
```

### 5.6 Revisions

**`GET /v3/functions/{name}/revisions`** — List all revisions.

Response:
```
{ revisions: RevisionInfo[] }

RevisionInfo {
  revision_id:  number
  created_at:   string
  schema_hash:  string
  is_current:   boolean
}
```

**`GET /v3/functions/{name}/revisions/{revisionID}`** — Get a specific revision.

Response: `FunctionRevision`
```
FunctionRevision {
  revision_id:    number
  source:         string
  schema_hash:    string
  created_at:     string
  input_schema:   object
  output_schema:  object
}
```

**`POST /v3/functions/{name}/revisions/{revisionID}/revert`** — Revert to a previous revision.

Response: `FunctionDetails`

### 5.7 Examples (Few-Shot Steering)

**`POST /v3/functions/{name}/examples`** — Create a single example.

**`POST /v3/functions/{name}/examples/batch`** — Batch create multiple examples.

**`GET /v3/functions/{name}/examples`** — List examples.

Query parameters:
| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 50 | Max items (max 200) |
| `offset` | integer | 0 | Items to skip |
| `tag` | string | — | Filter by tag (e.g. `train`, `test`, `golden`) |

**`DELETE /v3/functions/{name}/examples/{uuid}`** — Delete a single example.

### 5.8 Realtime WebSocket

**`WS /v3/realtime/{name}`** — WebSocket endpoint for realtime voice agent communication.

The client must send an HTTP Upgrade request. A successful connection returns `101 Switching Protocols`. The base client provides a helper to construct the WebSocket URL:

```
url = client.functions.getRealtimeWebSocketUrl(name)
// Returns: ws(s)://api.opper.ai/v3/realtime/{name}
```

---

## 6. Observability Endpoints

### 6.1 Spans

**`POST /v3/spans`** — Create a trace span.

Request: `CreateSpanRequest`
```
CreateSpanRequest {
  name:        string
  trace_id?:   string
  parent_id?:  string
  type?:       string
  input?:      string
  output?:     string
  error?:      string
  start_time?: string          // ISO 8601
  end_time?:   string          // ISO 8601
  meta?:       object
  metadata?:   object
  tags?:       object
}
```

Response: `CreateSpanResponse`
```
CreateSpanResponse {
  id:         string
  trace_id:   string
  name:       string
  parent_id?: string
  type?:      string
}
```

**`PATCH /v3/spans/{id}`** — Update an existing span.

Request: `UpdateSpanRequest`
```
UpdateSpanRequest {
  output?:    string
  error?:     string
  end_time?:  string
  meta?:      object
  metadata?:  object
  tags?:      object
}
```

### 6.2 Generations

**`GET /v3/generations`** — List recorded generations with pagination.

Query parameters:
| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | — | Semantic search query (hybrid dense+sparse) |
| `page` | integer | 1 | Page number |
| `page_size` | integer | 50 | Items per page |

Response:
```
{
  data: object[]               // Array of generation records
  meta: {
    page:        number
    page_size:   number
    total:       number
    total_pages: number
  }
}
```

**`GET /v3/generations/{id}`** — Get a specific generation.

**`DELETE /v3/generations/{id}`** — Delete a generation. Returns `{ deleted: boolean }`.

---

## 7. Compatibility Endpoints

These endpoints implement provider-specific API formats. The base client passes requests and responses through without translation — schemas match each provider's format exactly.

### 7.1 OpenAI Chat Completions

**`POST /v3/compat/chat/completions`** — SSE streaming supported via `stream` parameter.

Request: `ChatRequest`
```
ChatRequest {
  messages:              ChatRequestMessage[]
  model?:                string
  temperature?:          number
  top_p?:                number
  max_tokens?:           number
  max_completion_tokens?: number
  stop?:                 string[]
  stream?:               boolean
  stream_options?:       { include_usage?: boolean }
  tools?:                ChatRequestTool[]
  tool_choice?:          any
  output_schema?:        object
  reasoning_effort?:     string
}

ChatRequestMessage {
  role:           string
  content:        any              // string or structured content blocks
  name?:          string
  tool_call_id?:  string
  tool_calls?:    ChatToolCall[]
}

ChatRequestTool {
  type:      string
  function:  { name: string, description?: string, parameters?: object }
}
```

Response: `ChatResponse`
```
ChatResponse {
  id:       string
  object:   string
  created:  number
  model:    string
  choices:  ChatChoice[]
  usage:    { prompt_tokens: number, completion_tokens: number, total_tokens: number }
}

ChatChoice {
  index:          number
  message:        { role: string, content: string, tool_calls?: ChatToolCall[] }
  finish_reason:  string
}

ChatToolCall {
  id:        string
  type:      string
  function:  { name: string, arguments: string }
  thought_signature?: string
}
```

Streaming response: `ChatStreamChunk`
```
ChatStreamChunk {
  id:       string
  object:   string
  created:  number
  model:    string
  choices:  ChatStreamChoice[]
  usage?:   { prompt_tokens: number, completion_tokens: number, total_tokens: number }
  cost?:    number
}

ChatStreamChoice {
  index:          number
  delta:          { role?: string, content?: string, tool_calls?: ChatStreamToolCall[] }
  finish_reason:  string | null
}

ChatStreamToolCall {
  index:              number
  id?:                string
  type?:              string
  function?:          { name?: string, arguments?: string }
  thought_signature?: string
}
```

### 7.2 OpenAI Responses API

**`POST /v3/compat/responses`** — SSE streaming supported via `stream` parameter.

Request: `ResponsesRequest`
```
ResponsesRequest {
  input:                  any
  model?:                 string
  instructions?:          string
  tools?:                 ResponsesTool[]
  tool_choice?:           any
  temperature?:           number
  top_p?:                 number
  max_output_tokens?:     number
  reasoning?:             { effort?: string, summary?: string }
  metadata?:              object
  store?:                 boolean
  stream?:                boolean
  user?:                  string
  previous_response_id?:  string
}

ResponsesTool {
  type:              string
  name?:             string
  description?:      string
  parameters?:       object
  server_url?:       string
  server_label?:     string
  headers?:          map<string, string>
  require_approval?: string
}
```

Response: `ResponsesResponse`
```
ResponsesResponse {
  id:                   string
  object:               string
  created_at:           number
  model:                string
  status:               string
  output:               ResponsesOutputItem[]
  error:                { code: string, message: string } | null
  incomplete_details:   any
  tool_choice:          any
  output_text?:         string
  instructions?:        string
  max_output_tokens?:   number
  metadata?:            object
  previous_response_id?: string
  reasoning?:           { effort?: string, summary?: string }
  temperature?:         number
  top_p?:               number
  tools?:               ResponsesTool[]
  usage?:               { input_tokens: number, output_tokens: number, total_tokens: number, output_tokens_details?: { reasoning_tokens?: number } }
  user?:                string
}

ResponsesOutputItem {
  type:      string
  id?:       string
  role?:     string
  status?:   string
  content?:  ResponsesOutputContent[]
  name?:     string
  call_id?:  string
  arguments?: string
}

ResponsesOutputContent {
  type:         string
  text?:        string
  annotations?: any[]
}
```

### 7.3 Google Interactions

**`POST /v3/compat/v1beta/interactions`** — SSE streaming supported.

Request: `InteractionsRequest`
```
InteractionsRequest {
  contents?:            InteractionsContent[]
  tools?:               InteractionsTool[]
  generation_config?:   { temperature?: number, top_p?: number, top_k?: number, max_output_tokens?: number, thinking_level?: string }
  system_instruction?:  InteractionsContent
}

InteractionsContent {
  role?:   string
  parts?:  InteractionsContentPart[]
}

InteractionsContentPart {
  text?:        string
  inline_data?: { mime_type?: string, data?: string }
}

InteractionsTool {
  function_declarations?: { name: string, description?: string, parameters?: object }[]
}
```

Response: `InteractionsResponse`
```
InteractionsResponse {
  candidates?:     { content?: InteractionsContent, finish_reason?: string }[]
  usage_metadata?: { prompt_token_count?: number, candidates_token_count?: number, total_token_count?: number }
  error?:          { code?: number, message?: string, status?: string }
}
```

### 7.4 Anthropic Messages

**`POST /v3/compat/v1/messages`** — SSE streaming supported via `stream` parameter.

Request: `MessagesRequest`
```
MessagesRequest {
  model?:       string
  messages?:    { role?: string, content?: any }[]
  max_tokens?:  number
  system?:      string
  tools?:       { name?: string, description?: string, input_schema?: object }[]
  temperature?: number
  top_p?:       number
  top_k?:       number
  stream?:      boolean
}
```

Response: `MessagesResponse`
```
MessagesResponse {
  id?:          string
  type?:        string
  role?:        string
  content?:     { type?: string, text?: string, id?: string, name?: string, input?: object }[]
  model?:       string
  stop_reason?: string
  usage?:       { input_tokens?: number, output_tokens?: number }
}
```

### 7.5 Embeddings

**`POST /v3/compat/embeddings`**

Request: `EmbeddingsRequest`
```
EmbeddingsRequest {
  input:             any              // string, string[], or token array
  model:             string
  dimensions?:       number
  encoding_format?:  string
  user?:             string
}
```

Response: `EmbeddingsResponse`
```
EmbeddingsResponse {
  object:  string
  data:    { object: string, index: number, embedding: number[] }[]
  model:   string
  usage:   { prompt_tokens: number, total_tokens: number }
}
```

---

## 8. Utility Endpoints

### 8.1 `GET /v3/models` — List Models (No Auth)

Returns available models with capabilities and pricing.

Response: `ModelsResponse`
```
ModelsResponse {
  models?: ModelInfo[]
}

ModelInfo {
  id?:           string
  name?:         string
  provider?:     string
  capabilities?: object
  pricing?:      object
  parameters?:   object
}
```

### 8.2 `POST /v3/parse` — Parse Starlark

Parses a Starlark script and returns its AST and metadata.

Request: `ParseRequest`
```
ParseRequest {
  source:    string          // Starlark source code
  filename?: string          // Optional filename for error messages
}
```

Response: Parsed script information (unstructured object).

### 8.3 `GET /health` — Health Check (No Auth)

Response:
```
{ status: "ok" }
```

---

## 9. Error Handling

### `ApiError`

Thrown for any non-2xx HTTP response:

```
ApiError {
  status:      number          // HTTP status code
  statusText:  string          // HTTP status text
  body:        any             // Raw response body
}
```

### API Error Body Shape

When the API returns a structured error:

```
ErrorResponse {
  error: {
    code:      string          // Machine-readable error code
    message:   string          // Human-readable message
    details?:  any             // Additional context
  }
}
```

### Common Status Codes

| Status | Meaning |
|---|---|
| 400 | Bad request — invalid input, schema validation failure |
| 401 | Unauthorized — missing or invalid API key |
| 404 | Not found — function or resource doesn't exist |
| 429 | Rate limited |
| 500 | Internal server error |

---

## 10. Streaming Design Notes

### SSE Parsing

1. Read the response body as a text stream, line by line
2. For each line starting with `data: `:
   - Strip the `data: ` prefix (6 characters)
   - If the remainder is `[DONE]`, close the iterator
   - Otherwise, `JSON.parse` the remainder as a `StreamChunk` and yield it
3. Ignore lines that don't start with `data: ` (comments, empty lines, other SSE fields)
4. On connection close without `[DONE]`, treat as an error

### Back-Pressure

The async iterator / generator pattern naturally provides back-pressure. The client only reads the next chunk when the consumer is ready for it. No buffering beyond the HTTP client's internal buffer.

### Abort / Cancellation

- Pass `AbortSignal` through to the underlying HTTP request
- On abort, the TCP connection is closed, the response stream ends, and the async iterator throws an `AbortError`
- SDKs should clean up any partial state on abort

### Content-Type

- Request: `application/json`
- Response (run): `application/json`
- Response (stream): `text/event-stream`
