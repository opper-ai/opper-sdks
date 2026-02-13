# Task API SDK

> TypeScript SDK for the **Task API** v3.0.0 — a schema-driven generative API that uses Starlark scripts to orchestrate LLM-powered workflows.

## Features

- **Full TypeScript support** with strict types and interfaces
- **Zero dependencies** — uses native `fetch` (Node.js 18+)
- **ESM-first** module design
- **9 organized client classes** covering all API domains
- **SSE streaming** support for real-time function output
- **Bearer API key** authentication

## Installation

```bash
npm install task-api-sdk
```

> **Requirements:** Node.js >= 18.0.0

## Quick Start

```typescript
import { TaskApiClient } from 'task-api-sdk';

const client = new TaskApiClient({
  apiKey: 'your-api-key',
});

// Check server health
const health = await client.system.healthCheck();
console.log('Server status:', health.status);

// List available models
const models = await client.models.listModels();
console.log('Available models:', models.models);

// Run a function
const result = await client.functions.runFunction('my-function', {
  input: 'Hello, world!',
});
console.log('Output:', result.output);
```

## Configuration

### Authentication

The SDK uses Bearer token authentication. Pass your API key when creating a client:

```typescript
import { TaskApiClient } from 'task-api-sdk';

const client = new TaskApiClient({
  apiKey: 'your-api-key',
});
```

### Server Configuration

By default, the SDK connects to the production server. You can configure a custom base URL:

| Environment | URL |
|---|---|
| **Production** | `https://api.opper.ai` (default) |
| **Local development** | `http://localhost:8080` |

```typescript
// Connect to local dev server
const client = new TaskApiClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:8080',
});
```

### Custom Headers

You can include additional headers in every request:

```typescript
const client = new TaskApiClient({
  apiKey: 'your-api-key',
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

## Client Reference

The `TaskApiClient` composes all sub-clients, accessible as properties:

| Property | Client Class | Description |
|---|---|---|
| `client.functions` | `FunctionsClient` | Schema-driven function management and execution |
| `client.chat` | `ChatClient` | OpenAI-compatible chat completions (stub) |
| `client.responses` | `ResponsesClient` | OpenAI Responses API compatible endpoint (stub) |
| `client.interactions` | `InteractionsClient` | Google-compatible interactions endpoint (stub) |
| `client.models` | `ModelsClient` | Model registry and capabilities |
| `client.embeddings` | `EmbeddingsClient` | OpenAI-compatible embeddings (stub) |
| `client.generations` | `GenerationsClient` | Recorded HTTP request/response generations |
| `client.parse` | `ParseClient` | Starlark script parsing |
| `client.system` | `SystemClient` | System health and status |

You can also import and use individual client classes directly:

```typescript
import { FunctionsClient } from 'task-api-sdk';

const functions = new FunctionsClient({ apiKey: 'your-api-key' });
```

---

### Functions

Manage schema-driven functions including CRUD operations, revision management, execution, and streaming.

```typescript
// List all functions
const functions = await client.functions.listFunctions();

// Get a specific function
const fn = await client.functions.getFunction('my-function');

// Update a function's source code
const updated = await client.functions.updateFunction('my-function', {
  source: 'def main(input): return input.upper()',
});

// Delete a function
await client.functions.deleteFunction('my-function');

// Run a function
const result = await client.functions.runFunction('my-function', {
  input: 'Hello!',
});

// Stream function output (SSE)
for await (const chunk of client.functions.streamFunction('my-function', {
  input: 'Tell me a story',
})) {
  process.stdout.write(chunk);
}

// List revisions
const revisions = await client.functions.listRevisions('my-function');

// Get a specific revision
const revision = await client.functions.getRevision('my-function', 1);

// Revert to a previous revision
const reverted = await client.functions.revertRevision('my-function', 1);

// Create a realtime voice agent function
const realtime = await client.functions.createRealtimeFunction('my-function', {
  // realtime configuration
});

// Get WebSocket URL for realtime communication
const wsUrl = client.functions.realtimeWebSocket('my-function');
```

**Methods:**

| Method | Description |
|---|---|
| `listFunctions()` | List all cached functions |
| `getFunction(name)` | Get function details including script source |
| `updateFunction(name, body)` | Update a function's source code |
| `deleteFunction(name)` | Delete a cached function |
| `runFunction(name, body)` | Execute a function with input |
| `streamFunction(name, body)` | Execute with SSE streaming output |
| `listRevisions(name)` | List all revisions of a function |
| `getRevision(name, revisionID)` | Get a specific revision |
| `revertRevision(name, revisionID)` | Revert to a previous revision |
| `createRealtimeFunction(name, body)` | Generate a realtime voice agent function |
| `realtimeWebSocket(name)` | Get WebSocket URL for realtime communication |

---

### Chat

OpenAI-compatible chat completions. Currently a stub prepared for future implementation.

```typescript
// Chat endpoints will be available in a future release
const chat = client.chat;
```

---

### Responses

OpenAI Responses API compatible endpoint. Currently a stub prepared for future implementation.

```typescript
// Responses endpoints will be available in a future release
const responses = client.responses;
```

---

### Interactions

Google-compatible interactions endpoint. Currently a stub prepared for future implementation.

```typescript
// Interactions endpoints will be available in a future release
const interactions = client.interactions;
```

---

### Models

List available models with their capabilities and parameters.

```typescript
const response = await client.models.listModels();
for (const model of response.models ?? []) {
  console.log(`${model.name} — ${model.description}`);
}
```

**Methods:**

| Method | Description |
|---|---|
| `listModels()` | List all available models |

---

### Embeddings

OpenAI-compatible embeddings. Currently a stub prepared for future implementation.

```typescript
// Embeddings endpoints will be available in a future release
const embeddings = client.embeddings;
```

---

### Generations

Manage recorded HTTP request/response generations with pagination.

```typescript
// List generations with pagination
const generations = await client.generations.listGenerations(1, 25);

// Get a specific generation
const generation = await client.generations.getGeneration('generation-id');

// Delete a generation
const deleted = await client.generations.deleteGeneration('generation-id');
```

**Methods:**

| Method | Description |
|---|---|
| `listGenerations(page?, pageSize?)` | List generations with pagination |
| `getGeneration(id)` | Get a specific generation by ID |
| `deleteGeneration(id)` | Delete a specific generation |

---

### Parse

Parse Starlark scripts and retrieve AST/metadata.

```typescript
const result = await client.parse.parseStarlark({
  source: 'def main(input): return input',
});
console.log('Parsed:', result);
```

**Methods:**

| Method | Description |
|---|---|
| `parseStarlark(body)` | Parse a Starlark script and return AST/metadata |

---

### System

Check server health status. No authentication required.

```typescript
const health = await client.system.healthCheck();
console.log('Status:', health.status);
```

**Methods:**

| Method | Description |
|---|---|
| `healthCheck()` | Check server health status |

---

## Error Handling

The SDK throws `ApiError` for non-successful HTTP responses:

```typescript
import { ApiError } from 'task-api-sdk';

try {
  await client.functions.getFunction('nonexistent');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error('Response body:', error.body);
  }
}
```

### Request Cancellation

All methods accept an optional `AbortSignal` for request cancellation:

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const result = await client.functions.runFunction('my-function', {
  input: 'Hello',
}, {
  signal: controller.signal,
});
```

## Types Reference

All types are exported from the main entry point:

```typescript
import type {
  // Function types
  FunctionInfo,
  FunctionDetails,
  FunctionRevision,
  RevisionInfo,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  
  // Chat types
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatChoice,
  ChatUsage,
  ChatStreamChunk,
  ChatStreamChoice,
  ChatStreamDelta,
  
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
  InteractionsUsage,
  
  // Model types
  ModelInfo,
  ModelsResponse,
  
  // Embeddings types
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsDataItem,
  
  // Generation types
  GenerationConfig,
  ListGenerationsResponse,
  
  // Parse types
  ParseRequest,
  
  // Common types
  ErrorResponse,
  ErrorDetail,
  UsageInfo,
  ResponseMeta,
  Tool,
  Hints,
  GuardrailConfig,
  GuardInfo,
  ReasoningConfig,
  StreamOptions,
  
  // Client config
  ClientConfig,
  RequestOptions,
} from 'task-api-sdk';
```

## API Reference

| Endpoint Group | Base Path | Auth Required |
|---|---|---|
| Functions | `/v3/functions` | ✅ |
| Chat | — | ✅ |
| Responses | — | ✅ |
| Interactions | — | ✅ |
| Models | `/v3/models` | ❌ |
| Embeddings | — | ✅ |
| Generations | `/v3/generations` | ✅ |
| Parse | `/v3/parse` | ✅ |
| System | `/health` | ❌ |

**Production server:** `https://api.opper.ai`  
**Local dev server:** `http://localhost:8080`

## License

MIT

