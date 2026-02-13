# Task API TypeScript SDK

> Schema-driven generative API that uses Starlark scripts to orchestrate LLM-powered workflows.

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://api.opper.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Installation

```bash
npm install task-api-sdk
```

## Quick Start

```typescript
import { TaskApiClient } from 'task-api-sdk';

const client = new TaskApiClient({
  apiKey: process.env.OPPER_API_KEY!,
  // baseUrl defaults to https://api.opper.ai
});

// List available models
const models = await client.models.listModels();
console.log(`Available models: ${models.total}`);

// Check system health
const health = await client.system.healthCheck();
console.log(`Status: ${health.status}`);
```

## Authentication

The SDK uses **Bearer token** authentication. Pass your API key when creating the client:

```typescript
const client = new TaskApiClient({
  apiKey: 'your-api-key-here',
});
```

You can also configure a custom base URL and additional headers:

```typescript
const client = new TaskApiClient({
  apiKey: 'your-api-key-here',
  baseUrl: 'http://localhost:8080', // For local development
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

## Client Reference

The `TaskApiClient` exposes sub-clients for each API domain as readonly properties:

| Property | Client Class | Description |
| --- | --- | --- |
| `functions` | `FunctionsClient` | Schema-driven function management and execution |
| `chat` | `ChatClient` | OpenAI-compatible chat completions |
| `responses` | `ResponsesClient` | OpenAI Responses API compatible endpoint |
| `interactions` | `InteractionsClient` | Google-compatible interactions endpoint |
| `models` | `ModelsClient` | Model registry and capabilities |
| `embeddings` | `EmbeddingsClient` | OpenAI-compatible embeddings |
| `generations` | `GenerationsClient` | Recorded HTTP request/response generations |
| `parse` | `ParseClient` | Starlark script parsing |
| `system` | `SystemClient` | System health and status |

---

### Functions

Manage, execute, and stream schema-driven functions.

```typescript
// List all functions
const functions = await client.functions.listFunctions();

// Get function details
const details = await client.functions.getFunction('my-function');

// Run a function
const result = await client.functions.runFunction('my-function', {
  input_schema: { type: 'object', properties: { text: { type: 'string' } } },
  output_schema: { type: 'object', properties: { summary: { type: 'string' } } },
  input: { text: 'Hello, world!' },
  hints: { model: 'gpt-4o', temperature: 0.7 },
});
console.log(result.output);

// Stream a function
for await (const chunk of client.functions.streamFunction('my-function', {
  input_schema: { type: 'object', properties: { text: { type: 'string' } } },
  output_schema: { type: 'object', properties: { summary: { type: 'string' } } },
  input: { text: 'Hello, world!' },
  hints: { stream: true },
})) {
  console.log(chunk.output);
}

// Update a function's source
await client.functions.updateFunction('my-function', {
  source: 'def main(input): return {"result": input["text"]}',
});

// Delete a function
await client.functions.deleteFunction('my-function');

// List revisions
const revisions = await client.functions.listRevisions('my-function');

// Get a specific revision
const revision = await client.functions.getRevision('my-function', 1);

// Revert to a revision
await client.functions.revertRevision('my-function', 1);

// Create a realtime function
const realtime = await client.functions.createRealtimeFunction('my-agent', {
  instructions: 'You are a helpful assistant.',
  model: 'gpt-4o-realtime',
});

// Get WebSocket URL for realtime communication
const wsUrl = client.functions.realtimeWebSocket('my-agent');
```

**Methods:**

| Method | Description |
| --- | --- |
| `listFunctions()` | List all cached functions |
| `getFunction(name)` | Get function details including source |
| `updateFunction(name, body)` | Update a function's source code |
| `deleteFunction(name)` | Delete a cached function |
| `runFunction(name, body)` | Execute a function |
| `streamFunction(name, body)` | Execute a function with SSE streaming |
| `listRevisions(name)` | List all revisions of a function |
| `getRevision(name, revisionID)` | Get a specific revision |
| `revertRevision(name, revisionID)` | Revert to a previous revision |
| `createRealtimeFunction(name, body)` | Generate a realtime voice agent function |
| `realtimeWebSocket(name)` | Get WebSocket URL for realtime communication |

---

### Chat

OpenAI-compatible chat completions.

```typescript
// Create a chat completion
const response = await client.chat.createCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
  model: 'gpt-4o',
  temperature: 0.7,
});
console.log(response.choices[0].message.content);

// Stream a chat completion
for await (const chunk of client.chat.streamCompletion({
  messages: [
    { role: 'user', content: 'Tell me a story.' },
  ],
  model: 'gpt-4o',
})) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

**Methods:**

| Method | Description |
| --- | --- |
| `createCompletion(body)` | Create a chat completion |
| `streamCompletion(body)` | Create a streaming chat completion |

---

### Responses

OpenAI Responses API compatible endpoint.

```typescript
// Create a response
const response = await client.responses.create({
  input: 'Explain quantum computing.',
  model: 'gpt-4o',
});
console.log(response.output_text);

// Stream a response
for await (const chunk of client.responses.createStream({
  input: 'Write a poem about coding.',
  model: 'gpt-4o',
})) {
  console.log(chunk);
}
```

**Methods:**

| Method | Description |
| --- | --- |
| `create(body)` | Create a response |
| `createStream(body)` | Create a streaming response |

---

### Interactions

Google-compatible interactions endpoint.

```typescript
// Create an interaction
const response = await client.interactions.create({
  input: 'Summarize this text.',
  model: 'gemini-pro',
});
console.log(response.outputs);

// Stream an interaction
for await (const chunk of client.interactions.createStream({
  input: 'Generate a story.',
  model: 'gemini-pro',
})) {
  console.log(chunk.outputs);
}
```

**Methods:**

| Method | Description |
| --- | --- |
| `create(body)` | Create an interaction |
| `createStream(body)` | Create a streaming interaction |

---

### Models

Access the model registry with capabilities, pricing, and parameters.

```typescript
const models = await client.models.listModels();
for (const model of models.models) {
  console.log(`${model.id} - ${model.description} (${model.provider})`);
}
```

**Methods:**

| Method | Description |
| --- | --- |
| `listModels()` | List all available models |

---

### Embeddings

OpenAI-compatible embeddings.

```typescript
const embeddings = await client.embeddings.create({
  input: 'Hello, world!',
  model: 'text-embedding-3-small',
});
console.log(`Dimensions: ${embeddings.data[0].embedding.length}`);
console.log(`Tokens used: ${embeddings.usage.total_tokens}`);
```

**Methods:**

| Method | Description |
| --- | --- |
| `create(body)` | Create embeddings for input text(s) |

---

### Generations

Manage recorded HTTP request/response generations.

```typescript
// List generations with pagination
const generations = await client.generations.listGenerations(1, 10);
console.log(`Total: ${generations.meta.total}`);

// Get a specific generation
const generation = await client.generations.getGeneration('gen-id');

// Delete a generation
const result = await client.generations.deleteGeneration('gen-id');
console.log(`Deleted: ${result.deleted}`);
```

**Methods:**

| Method | Description |
| --- | --- |
| `listGenerations(page?, pageSize?)` | List generations with pagination |
| `getGeneration(id)` | Get a specific generation |
| `deleteGeneration(id)` | Delete a generation |

---

### Parse

Parse Starlark scripts and extract AST/metadata.

```typescript
const parsed = await client.parse.parseStarlark({
  source: 'def main(input): return {"result": input["text"]}',
});
console.log(parsed);
```

**Methods:**

| Method | Description |
| --- | --- |
| `parseStarlark(body)` | Parse a Starlark script |

---

### System

System health and status (no authentication required).

```typescript
const health = await client.system.healthCheck();
console.log(`Status: ${health.status}`);
```

**Methods:**

| Method | Description |
| --- | --- |
| `healthCheck()` | Check server health and readiness |

---

## Error Handling

The SDK throws `ApiError` for non-successful HTTP responses:

```typescript
import { TaskApiClient, ApiError } from 'task-api-sdk';

const client = new TaskApiClient({ apiKey: 'your-api-key' });

try {
  await client.functions.getFunction('nonexistent');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error('Response body:', error.body);
  } else {
    throw error;
  }
}
```

## Types Reference

All types are exported from the main package entry point:

```typescript
import type {
  // Client config
  ClientConfig,
  RequestOptions,

  // Chat types
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatChoice,
  ChatStreamChunk,
  ChatStreamDelta,
  ChatUsage,

  // Function types
  RunRequest,
  RunResponse,
  FunctionInfo,
  FunctionDetails,
  FunctionRevision,
  UpdateFunctionRequest,
  Hints,
  Tool,

  // Responses types
  ResponsesRequest,
  ResponsesResponse,
  ResponsesOutputItem,
  ResponsesTool,
  ResponsesUsage,

  // Interactions types
  InteractionsRequest,
  InteractionsResponse,
  InteractionsOutput,
  InteractionsTool,

  // Embeddings types
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsDataItem,

  // Model types
  ModelInfo,
  ModelsResponse,

  // Parse types
  ParseRequest,

  // Error types
  ErrorResponse,
  ErrorDetail,
} from 'task-api-sdk';
```

## API Documentation

- **Production Server:** `https://api.opper.ai`
- **Local Development:** `http://localhost:8080`
- **API Version:** 3.0.0

## Requirements

- **Node.js** >= 18.0.0 (uses native `fetch`)
- **TypeScript** >= 5.5 (recommended)

## License

MIT

