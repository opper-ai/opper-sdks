# Task API SDK

> TypeScript SDK for the **Task API** (v3.0.0) — a schema-driven generative API that uses Starlark scripts to orchestrate LLM-powered workflows.

## Installation

```bash
npm install task-api-sdk
```

> **Requirements:** Node.js ≥ 18.0.0 (uses native `fetch`)

## Quick Start

```ts
import { ChatClient } from 'task-api-sdk';

const chat = new ChatClient({
  apiKey: 'your-api-key',
  // baseUrl: 'https://api.opper.ai' (default)
});

const response = await chat.chatCompletions({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello, world!' }],
});

console.log(response.choices?.[0]?.message?.content);
```

## Configuration

All client classes accept a `ClientConfig` object:

```ts
import type { ClientConfig } from 'task-api-sdk';

const config: ClientConfig = {
  apiKey: 'your-api-key',           // Required — passed as Bearer token
  baseUrl: 'https://api.opper.ai',  // Optional — defaults to production
  headers: {                         // Optional — extra headers for every request
    'X-Custom-Header': 'value',
  },
};
```

## Clients

The SDK provides nine client classes, one for each API domain:

| Client | Import | Description |
| --- | --- | --- |
| `FunctionsClient` | `task-api-sdk` | Schema-driven function management and execution |
| `ChatClient` | `task-api-sdk` | OpenAI-compatible chat completions |
| `ResponsesClient` | `task-api-sdk` | OpenAI Responses API compatible endpoint |
| `InteractionsClient` | `task-api-sdk` | Google-compatible interactions endpoint |
| `ModelsClient` | `task-api-sdk` | Model registry and capabilities |
| `EmbeddingsClient` | `task-api-sdk` | OpenAI-compatible embeddings |
| `GenerationsClient` | `task-api-sdk` | Recorded HTTP request/response generations |
| `ParseClient` | `task-api-sdk` | Starlark script parsing |
| `SystemClient` | `task-api-sdk` | System health and status |

---

### Functions

```ts
import { FunctionsClient } from 'task-api-sdk';

const functions = new FunctionsClient({ apiKey: 'your-api-key' });

// List all functions
const list = await functions.listFunctions();

// Get function details
const details = await functions.getFunction('my-function');

// Update a function
await functions.updateFunction('my-function', { source: 'print("hello")' });

// Delete a function
await functions.deleteFunction('my-function');

// Run a function
const result = await functions.runFunction('my-function', {
  input: { text: 'Hello' },
});
console.log(result);

// Stream a function (SSE)
for await (const event of functions.streamFunction('my-function', {
  input: { text: 'Hello' },
})) {
  console.log(event.data);
}

// Revisions
const revisions = await functions.listRevisions('my-function');
const revision = await functions.getRevision('my-function', 1);
await functions.revertRevision('my-function', 1);

// Realtime
const realtime = await functions.createRealtimeFunction('my-function', {
  model: 'gpt-4',
});
const wsUrl = functions.realtimeWebSocket('my-function');
```

---

### Chat

```ts
import { ChatClient } from 'task-api-sdk';

const chat = new ChatClient({ apiKey: 'your-api-key' });

// Non-streaming chat completion
const response = await chat.chatCompletions({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
});
console.log(response.choices?.[0]?.message?.content);

// Streaming chat completion
const stream = chat.chatCompletionsStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story.' }],
});

for await (const chunk of stream) {
  const delta = chunk.choices?.[0]?.delta?.content;
  if (delta) process.stdout.write(delta);
}
console.log(); // newline
```

---

### Responses

```ts
import { ResponsesClient } from 'task-api-sdk';

const responses = new ResponsesClient({ apiKey: 'your-api-key' });

// Non-streaming response
const result = await responses.createResponse({
  model: 'gpt-4',
  input: 'Explain quantum computing in simple terms.',
});
console.log(result);

// Streaming response
for await (const event of responses.createResponseStream({
  model: 'gpt-4',
  input: 'Write a poem about the sea.',
})) {
  console.log(event.data);
}
```

---

### Interactions

```ts
import { InteractionsClient } from 'task-api-sdk';

const interactions = new InteractionsClient({ apiKey: 'your-api-key' });

// Non-streaming interaction
const result = await interactions.createInteraction({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(result);

// Streaming interaction
for await (const event of interactions.createInteractionStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
})) {
  console.log(event.data);
}
```

---

### Models

```ts
import { ModelsClient } from 'task-api-sdk';

const models = new ModelsClient({ apiKey: 'your-api-key' });

const response = await models.listModels();
for (const model of response.data ?? []) {
  console.log(model.id, model.name);
}
```

---

### Embeddings

```ts
import { EmbeddingsClient } from 'task-api-sdk';

const embeddings = new EmbeddingsClient({ apiKey: 'your-api-key' });

const result = await embeddings.createEmbeddings({
  model: 'text-embedding-ada-002',
  input: 'The quick brown fox jumps over the lazy dog.',
});

console.log(result.data?.[0]?.embedding);
console.log(result.usage);
```

---

### Generations

```ts
import { GenerationsClient } from 'task-api-sdk';

const generations = new GenerationsClient({ apiKey: 'your-api-key' });

// List generations with pagination
const list = await generations.listGenerations({ page: 1, page_size: 10 });
console.log(list.meta);

// Get a specific generation
const generation = await generations.getGeneration('generation-id');
console.log(generation);

// Delete a generation
const deleteResult = await generations.deleteGeneration('generation-id');
console.log(deleteResult);
```

---

### Parse

```ts
import { ParseClient } from 'task-api-sdk';

const parse = new ParseClient({ apiKey: 'your-api-key' });

const result = await parse.parseStarlark({
  source: 'def hello(): return "world"',
});
console.log(result);
```

---

### System

```ts
import { SystemClient } from 'task-api-sdk';

// Note: health check does not require authentication,
// but apiKey is still required by the client constructor
const system = new SystemClient({ apiKey: '' });

const health = await system.healthCheck();
console.log(health.status);
```

---

## Streaming

The SDK supports Server-Sent Events (SSE) streaming for several endpoints:

- **`ChatClient.chatCompletionsStream()`** — returns `AsyncGenerator<ChatStreamChunk>`
- **`FunctionsClient.streamFunction()`** — returns `AsyncGenerator<SSEEvent>`
- **`ResponsesClient.createResponseStream()`** — returns `AsyncGenerator<SSEEvent>`
- **`InteractionsClient.createInteractionStream()`** — returns `AsyncGenerator<SSEEvent>`

All streaming methods return async generators that can be consumed with `for await...of`:

```ts
import { ChatClient } from 'task-api-sdk';

const chat = new ChatClient({ apiKey: 'your-api-key' });

for await (const chunk of chat.chatCompletionsStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
})) {
  // ChatStreamChunk is already parsed
  const content = chunk.choices?.[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
```

For `SSEEvent`-based streams, the `data` field contains a raw JSON string:

```ts
import { FunctionsClient } from 'task-api-sdk';

const functions = new FunctionsClient({ apiKey: 'your-api-key' });

for await (const event of functions.streamFunction('my-func', {
  input: { text: 'Hello' },
})) {
  if (event.data === '[DONE]') break;
  const parsed = JSON.parse(event.data);
  console.log(parsed);
}
```

## Error Handling

All clients throw an `ApiError` when the API returns a non-OK response:

```ts
import { ApiError, ChatClient } from 'task-api-sdk';

const chat = new ChatClient({ apiKey: 'your-api-key' });

try {
  await chat.chatCompletions({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`HTTP ${error.status} ${error.statusText}`);
    console.error('Response body:', error.body);
  } else {
    throw error;
  }
}
```

## TypeScript Types

All request and response types are exported from the main entry point:

```ts
import type {
  // Chat types
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ChatMessage,
  ChatChoice,
  ChatUsage,

  // Function types
  FunctionInfo,
  FunctionDetails,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,

  // Responses types
  ResponsesRequest,
  ResponsesResponse,
  ResponsesOutputItem,

  // Interactions types
  InteractionsRequest,
  InteractionsResponse,

  // Models types
  ModelInfo,
  ModelsResponse,

  // Embeddings types
  EmbeddingsRequest,
  EmbeddingsResponse,

  // Parse types
  ParseRequest,

  // Error types
  ErrorResponse,
  ErrorDetail,

  // Client configuration
  ClientConfig,
  RequestOptions,
  SSEEvent,
} from 'task-api-sdk';
```

### Key Types Reference

| Type | Description |
| --- | --- |
| `ChatRequest` | Chat completion request body |
| `ChatResponse` | Chat completion response |
| `ChatStreamChunk` | Single chunk from a streaming chat response |
| `FunctionInfo` | Summary of a cached function |
| `FunctionDetails` | Full function details including source |
| `RunRequest` | Function execution request body |
| `RunResponse` | Function execution response |
| `ResponsesRequest` | OpenAI Responses API request body |
| `ResponsesResponse` | OpenAI Responses API response |
| `InteractionsRequest` | Google-compatible interaction request |
| `InteractionsResponse` | Google-compatible interaction response |
| `ModelInfo` | Model details and capabilities |
| `ModelsResponse` | List of available models |
| `EmbeddingsRequest` | Embeddings request body |
| `EmbeddingsResponse` | Embeddings response with vectors |
| `ParseRequest` | Starlark parse request |
| `ErrorResponse` | Structured error response from the API |
| `ApiError` | Error class thrown by clients (has `status`, `statusText`, `body`) |
| `ClientConfig` | Client configuration (apiKey, baseUrl, headers) |
| `SSEEvent` | Parsed Server-Sent Event (data, event) |

## License

MIT

