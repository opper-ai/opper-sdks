# Task API TypeScript SDK v3.0.0

A TypeScript SDK for the **Task API** — a schema-driven generative API that uses Starlark scripts to orchestrate LLM-powered workflows.

## Features

- 🔧 **Functions** — manage, execute, and stream Starlark-based functions
- 💬 **Chat** — OpenAI-compatible chat completions with streaming support
- 📨 **Responses** — OpenAI Responses API compatible endpoint
- 🤖 **Interactions** — Google-compatible generative AI interactions
- 📊 **Models** — list available models with capabilities and pricing
- 📐 **Embeddings** — OpenAI-compatible text embeddings
- 📝 **Generations** — manage recorded HTTP request/response generations
- 🧩 **Parse** — parse Starlark scripts into AST/metadata
- ❤️ **System** — health check and system status

## Installation

```bash
npm install task-api-sdk
```

## Quick Start

```typescript
import { TaskApiClient } from 'task-api-sdk';

const client = new TaskApiClient({
  apiKey: process.env.OPPER_API_KEY!,
});

// List available models
const models = await client.models.listModels();
console.log('Available models:', models);

// Run a chat completion
const chatResponse = await client.chat.createCompletion({
  messages: [{ role: 'user', content: 'Hello, world!' }],
  model: 'gpt-4',
});
console.log('Chat response:', chatResponse.choices[0].message.content);
```

## Configuration

The SDK is configured via a `ClientConfig` object passed to the `TaskApiClient` constructor:

```typescript
import { TaskApiClient } from 'task-api-sdk';

const client = new TaskApiClient({
  // Required: Your API key for authentication
  apiKey: 'your-api-key',

  // Optional: Override the base URL (default: https://api.opper.ai)
  baseUrl: 'https://api.opper.ai',

  // Optional: Custom headers for all requests
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

### Authentication

All API requests (except `/v3/models` and `/health`) require an API key. The SDK sends the API key as a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

### Environment Variable

We recommend storing your API key in an environment variable:

```bash
export OPPER_API_KEY="your-api-key"
```

```typescript
const client = new TaskApiClient({
  apiKey: process.env.OPPER_API_KEY!,
});
```

## Client Reference

The `TaskApiClient` exposes the following sub-clients:

| Property | Client Class | Description |
|---|---|---|
| `client.functions` | `FunctionsClient` | Function management and execution |
| `client.chat` | `ChatClient` | OpenAI-compatible chat completions |
| `client.responses` | `ResponsesClient` | OpenAI Responses API |
| `client.interactions` | `InteractionsClient` | Google-compatible interactions |
| `client.models` | `ModelsClient` | List available models |
| `client.embeddings` | `EmbeddingsClient` | Text embeddings |
| `client.generations` | `GenerationsClient` | Generation record management |
| `client.parse` | `ParseClient` | Starlark script parsing |
| `client.system` | `SystemClient` | Health check and system status |

---

### Functions Client

Manage and execute Starlark-based functions.

```typescript
// List all functions
const functions = await client.functions.listFunctions();
console.log(functions);

// Get function details
const details = await client.functions.getFunction('my-function');
console.log(details);

// Run a function
const result = await client.functions.runFunction('my-function', {
  input_schema: { type: 'object', properties: { text: { type: 'string' } } },
  output_schema: { type: 'object', properties: { result: { type: 'string' } } },
  input: { text: 'Hello' },
  hints: {
    model: 'gpt-4',
    temperature: 0.7,
  },
});
console.log('Output:', result.output);
console.log('Meta:', result.meta);

// Stream a function execution
const stream = client.functions.streamFunction('my-function', {
  input_schema: { type: 'object', properties: { text: { type: 'string' } } },
  output_schema: { type: 'object', properties: { result: { type: 'string' } } },
  input: { text: 'Hello' },
  hints: { stream: true },
});
for await (const chunk of stream) {
  console.log('Chunk:', chunk);
}

// Update a function
await client.functions.updateFunction('my-function', {
  source: 'def main(input): return {"result": input["text"].upper()}',
});

// Delete a function
await client.functions.deleteFunction('my-function');

// List revisions
const revisions = await client.functions.listRevisions('my-function');
console.log(revisions);

// Get a specific revision
const revision = await client.functions.getRevision('my-function', 1);
console.log(revision);

// Revert to a previous revision
await client.functions.revertRevision('my-function', 1);

// Create a realtime function
const realtime = await client.functions.createRealtimeFunction('my-agent', {
  instructions: 'You are a helpful assistant.',
  model: 'gpt-4',
});

// Get WebSocket URL for realtime communication
const wsUrl = client.functions.getRealtimeWebSocketUrl('my-agent');
console.log('WebSocket URL:', wsUrl);
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `listFunctions()` | `GET /v3/functions` | List all cached functions |
| `getFunction(name)` | `GET /v3/functions/{name}` | Get function details |
| `updateFunction(name, body)` | `PUT /v3/functions/{name}` | Update function source |
| `deleteFunction(name)` | `DELETE /v3/functions/{name}` | Delete a function |
| `createRealtimeFunction(name, body)` | `POST /v3/functions/{name}/realtime` | Create realtime voice agent |
| `listRevisions(name)` | `GET /v3/functions/{name}/revisions` | List function revisions |
| `getRevision(name, revisionID)` | `GET /v3/functions/{name}/revisions/{revisionID}` | Get a specific revision |
| `revertRevision(name, revisionID)` | `POST /v3/functions/{name}/revisions/{revisionID}/revert` | Revert to a revision |
| `runFunction(name, body)` | `POST /v3/functions/{name}/run` | Execute a function |
| `streamFunction(name, body)` | `POST /v3/functions/{name}/stream` | Stream function execution (SSE) |
| `getRealtimeWebSocketUrl(name)` | — | Get WebSocket URL for realtime |

---

### Chat Client

OpenAI-compatible chat completion endpoints.

```typescript
// Standard chat completion
const response = await client.chat.createCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' },
  ],
  model: 'gpt-4',
  temperature: 0.7,
});
console.log(response.choices[0].message.content);

// Streaming chat completion
const stream = client.chat.streamCompletion({
  messages: [{ role: 'user', content: 'Tell me a story.' }],
  model: 'gpt-4',
});
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
console.log(); // newline after streaming

// With tools
const toolResponse = await client.chat.createCompletion({
  messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
  model: 'gpt-4',
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      },
    },
  ],
});
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `createCompletion(body)` | `POST /v1/chat/completions` | Create a chat completion |
| `streamCompletion(body)` | `POST /v1/chat/completions` | Stream a chat completion (SSE) |

---

### Responses Client

OpenAI Responses API compatible endpoints.

```typescript
const response = await client.responses.createResponse({
  input: 'Explain quantum computing in simple terms.',
  model: 'gpt-4',
  instructions: 'You are a science teacher.',
  temperature: 0.7,
});
console.log(response.output_text);
console.log('Usage:', response.usage);

// With tools
const toolResponse = await client.responses.createResponse({
  input: 'What is the weather in Tokyo?',
  model: 'gpt-4',
  tools: [
    {
      type: 'function',
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
      },
    },
  ],
});
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `createResponse(body)` | `POST /v1/responses` | Create a response |

---

### Interactions Client

Google-compatible generative AI interactions and Anthropic-compatible messages.

```typescript
// Google-compatible generateContent
const response = await client.interactions.generateContent({
  contents: [
    {
      role: 'user',
      parts: [{ text: 'Explain machine learning.' }],
    },
  ],
  generation_config: {
    temperature: 0.7,
    max_output_tokens: 1024,
  },
});
const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
console.log(text);

// Anthropic-compatible messages
const messagesResponse = await client.interactions.createMessage({
  model: 'claude-3-opus',
  messages: [
    { role: 'user', content: 'Hello, Claude!' },
  ],
  max_tokens: 1024,
});
console.log(messagesResponse.content?.[0]?.text);
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `generateContent(body)` | `POST /v1/interactions` | Google-compatible content generation |
| `createMessage(body)` | `POST /v1/messages` | Anthropic-compatible messages |

---

### Models Client

List available models. **No authentication required.**

```typescript
const response = await client.models.listModels();
for (const model of response.models ?? []) {
  console.log(`${model.name} (${model.provider}) - ${model.id}`);
}
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `listModels()` | `GET /v3/models` | List all available models |

---

### Embeddings Client

OpenAI-compatible text embeddings.

```typescript
const response = await client.embeddings.createEmbeddings({
  input: 'The quick brown fox jumps over the lazy dog.',
  model: 'text-embedding-ada-002',
});
console.log('Embedding dimensions:', response.data[0].embedding.length);
console.log('Usage:', response.usage);
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `createEmbeddings(body)` | `POST /v1/embeddings` | Create text embeddings |

---

### Generations Client

Manage recorded HTTP request/response generations.

```typescript
// List generations with optional search
const list = await client.generations.listGenerations({
  query: 'weather',
  page: 1,
  page_size: 20,
});
console.log(`Found ${list.meta.total} generations`);
for (const gen of list.data) {
  console.log(gen);
}

// Get a specific generation
const generation = await client.generations.getGeneration('gen-id-123');
console.log(generation);

// Delete a generation
const deleted = await client.generations.deleteGeneration('gen-id-123');
console.log('Deleted:', deleted.deleted);
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `listGenerations(params?)` | `GET /v3/generations` | List generations with pagination |
| `getGeneration(id)` | `GET /v3/generations/{id}` | Get a specific generation |
| `deleteGeneration(id)` | `DELETE /v3/generations/{id}` | Delete a generation |

---

### Parse Client

Parse Starlark scripts into AST/metadata.

```typescript
const result = await client.parse.parseStarlark({
  source: 'def main(input): return {"result": input["text"]}',
  filename: 'example.star',
});
console.log(result);
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `parseStarlark(body)` | `POST /v3/parse` | Parse a Starlark script |

---

### System Client

System health and status. **No authentication required.**

```typescript
const health = await client.system.healthCheck();
console.log('Server status:', health.status);
```

#### Methods

| Method | HTTP | Description |
|---|---|---|
| `healthCheck()` | `GET /health` | Check server health status |

---

## Error Handling

The SDK throws `ApiError` for non-successful HTTP responses:

```typescript
import { TaskApiClient, ApiError } from 'task-api-sdk';

const client = new TaskApiClient({ apiKey: 'your-api-key' });

try {
  const result = await client.functions.runFunction('nonexistent', {
    input_schema: {},
    output_schema: {},
    input: {},
  });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.status}: ${error.statusText}`);
    console.error('Response body:', error.body);
  } else {
    throw error;
  }
}
```

The `ApiError` class provides:

| Property | Type | Description |
|---|---|---|
| `status` | `number` | HTTP status code |
| `statusText` | `string` | HTTP status text |
| `body` | `unknown` | Parsed response body |
| `message` | `string` | Human-readable error message |

## Types Reference

All TypeScript types are exported from the package:

```typescript
import type {
  // Configuration
  ClientConfig,
  RequestOptions,

  // Chat
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatChoice,
  ChatUsage,
  ChatRequestMessage,
  ChatRequestTool,
  ChatStreamChunk,
  ChatStreamChoice,
  ChatStreamDelta,
  StreamOptions,

  // Functions
  FunctionInfo,
  FunctionDetails,
  FunctionRevision,
  RunRequest,
  RunResponse,
  ResponseMeta,
  UsageInfo,
  GuardInfo,
  GuardrailConfig,
  Hints,
  Tool,
  UpdateFunctionRequest,
  RevisionInfo,
  RealtimeCreateRequest,
  RealtimeCreateResponse,

  // Responses (OpenAI Responses API)
  ResponsesRequest,
  ResponsesResponse,
  ResponsesOutputItem,
  ResponsesOutputContent,
  ResponsesTool,
  ResponsesUsage,
  ResponsesError,

  // Interactions (Google-compatible)
  InteractionsRequest,
  InteractionsResponse,
  InteractionsFunction,
  InteractionsOutput,
  InteractionsTool,
  InteractionsUsage,

  // Messages (Anthropic-compatible)
  MessagesRequest,
  MessagesResponse,
  MessagesMessage,
  MessagesResponseBlock,
  MessagesTool,
  MessagesUsage,

  // Models
  ModelInfo,
  ModelsResponse,

  // Embeddings
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsDataItem,
  EmbeddingsUsageInfo,

  // Parse
  ParseRequest,

  // Generations
  ListGenerationsParams,

  // Spans
  CreateSpanRequest,
  CreateSpanResponse,
  UpdateSpanRequest,

  // Errors
  ErrorDetail,
  ErrorResponse,
} from 'task-api-sdk';

import { ApiError } from 'task-api-sdk';
```

## API Servers

| Environment | URL |
|---|---|
| Production | `https://api.opper.ai` |
| Local Development | `http://localhost:8080` |

By default, the SDK connects to `https://api.opper.ai`. Override with the `baseUrl` option:

```typescript
const client = new TaskApiClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:8080',
});
```

## Requirements

- **Node.js** 18+ (requires native `fetch` support)
- **TypeScript** 5.0+ (for development)

## License

MIT

