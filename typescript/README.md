# Task API SDK

> Schema-driven generative API that uses Starlark scripts to orchestrate LLM-powered workflows.

**Version:** 3.0.0

## Installation

```bash
npm install task-api-sdk
```

## Authentication

The Task API uses **Bearer token authentication**. Pass your API key when creating any client instance:

```typescript
import { FunctionsClient } from 'task-api-sdk';

const client = new FunctionsClient({
  apiKey: 'your-api-key',
});
```

The API key is sent as a `Bearer` token in the `Authorization` header with every request.

## Quickstart

```typescript
import { FunctionsClient } from 'task-api-sdk';

const functions = new FunctionsClient({
  apiKey: process.env.OPPER_API_KEY!,
});

// List all functions
const allFunctions = await functions.listFunctions();
console.log(allFunctions);

// Run a function
const result = await functions.runFunction('my-function', {
  input: { message: 'Hello, world!' },
});
console.log(result);
```

## API Servers

| Environment | URL |
| --- | --- |
| Production | `https://api.opper.ai` |
| Local development | `http://localhost:8080` |

By default, the SDK connects to the **production** server. You can override the base URL:

```typescript
const client = new FunctionsClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:8080',
});
```

## Clients

The SDK provides dedicated client classes for each API domain. All clients extend `BaseClient` and share the same constructor signature:

```typescript
import { ClientConfig } from 'task-api-sdk';

const config: ClientConfig = {
  apiKey: 'your-api-key',       // Required
  baseUrl: 'https://api.opper.ai', // Optional (default: https://api.opper.ai)
  headers: {},                     // Optional additional headers
};
```

---

### FunctionsClient

Manage and execute schema-driven functions.

```typescript
import { FunctionsClient } from 'task-api-sdk';

const functions = new FunctionsClient({ apiKey: 'your-api-key' });
```

| Method | Description |
| --- | --- |
| `listFunctions()` | List all cached functions |
| `getFunction(name)` | Get details of a specific function |
| `updateFunction(name, body)` | Update a function's source code |
| `deleteFunction(name)` | Delete a cached function |
| `createRealtimeFunction(name, body)` | Generate a realtime voice agent function |
| `listRevisions(name)` | List all revisions of a function |
| `getRevision(name, revisionID)` | Get a specific revision |
| `revertRevision(name, revisionID)` | Revert to a previous revision |
| `runFunction(name, body)` | Execute a function with given input |
| `streamFunction(name, body)` | Execute a function with SSE streaming output |
| `realtimeWebSocket(name)` | Get the WebSocket URL for realtime communication |

#### Example: Run a function

```typescript
const result = await functions.runFunction('summarize', {
  input: { text: 'Long article text here...' },
});
console.log(result);
```

#### Example: Stream function output

```typescript
for await (const chunk of functions.streamFunction('summarize', {
  input: { text: 'Long article text here...' },
})) {
  // Each chunk is a raw SSE data string; parse as JSON if needed
  console.log(chunk);
}
```

#### Example: Manage revisions

```typescript
const revisions = await functions.listRevisions('my-function');
const revision = await functions.getRevision('my-function', 1);
await functions.revertRevision('my-function', 1);
```

---

### ModelsClient

List available models with capabilities, pricing, and parameters.

> **Note:** The models endpoint does not require authentication.

```typescript
import { ModelsClient } from 'task-api-sdk';

const models = new ModelsClient({ apiKey: '' });
const response = await models.listModels();

for (const model of response.models) {
  console.log(`${model.name} (${model.provider}): ${model.description}`);
}
```

| Method | Description |
| --- | --- |
| `listModels()` | List all available models |

---

### GenerationsClient

Manage recorded HTTP request/response generations with pagination.

```typescript
import { GenerationsClient } from 'task-api-sdk';

const generations = new GenerationsClient({ apiKey: 'your-api-key' });
```

| Method | Description |
| --- | --- |
| `listGenerations(options?)` | List generations with optional pagination (`page`, `pageSize`) |
| `getGeneration(id)` | Get a specific generation by ID |
| `deleteGeneration(id)` | Delete a generation |

#### Example: List generations with pagination

```typescript
const page = await generations.listGenerations({ page: 1, pageSize: 10 });
console.log(page);
```

#### Example: Delete a generation

```typescript
const result = await generations.deleteGeneration('generation-id');
console.log(result);
```

---

### ParseClient

Parse Starlark scripts and retrieve AST and metadata.

```typescript
import { ParseClient } from 'task-api-sdk';

const parse = new ParseClient({ apiKey: 'your-api-key' });
const result = await parse.parseStarlark({ source: 'print("hello")' });
console.log(result);
```

| Method | Description |
| --- | --- |
| `parseStarlark(body)` | Parse a Starlark script and return its AST |

---

### SystemClient

System health and status monitoring.

> **Note:** The health check endpoint does not require authentication.

```typescript
import { SystemClient } from 'task-api-sdk';

const system = new SystemClient({ apiKey: '' });
const health = await system.healthCheck();
console.log(health);
```

| Method | Description |
| --- | --- |
| `healthCheck()` | Returns server health and readiness status |

---

### ChatClient

OpenAI-compatible chat completions client. Schema types are available for future implementation.

```typescript
import { ChatClient } from 'task-api-sdk';
```

---

### ResponsesClient

OpenAI Responses API compatible client. Schema types are available for future implementation.

```typescript
import { ResponsesClient } from 'task-api-sdk';
```

---

### InteractionsClient

Google-compatible interactions client. Schema types are available for future implementation.

```typescript
import { InteractionsClient } from 'task-api-sdk';
```

---

### EmbeddingsClient

OpenAI-compatible embeddings client. Schema types are available for future implementation.

```typescript
import { EmbeddingsClient } from 'task-api-sdk';
```

---

## Error Handling

All clients throw an `ApiError` for non-2xx HTTP responses:

```typescript
import { ApiError } from 'task-api-sdk';

try {
  await functions.runFunction('nonexistent', { input: {} });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error('Response body:', error.body);
  }
}
```

The `ApiError` class extends `Error` and includes:
- `status` — HTTP status code
- `statusText` — HTTP status text
- `body` — Parsed response body (if available)

## Types Reference

All TypeScript interfaces and types are exported from the main entry point:

```typescript
import type {
  // Functions
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
  Hints,
  GuardInfo,
  GuardrailConfig,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  ReasoningConfig,
  ResponseMeta,
  RevisionInfo,
  Tool,
  UsageInfo,

  // Chat (OpenAI-compatible)
  ChatChoice,
  ChatFunctionCall,
  ChatMessage,
  ChatRequest,
  ChatRequestMessage,
  ChatRequestTool,
  ChatRequestToolFunction,
  ChatResponse,
  ChatStreamChoice,
  ChatStreamChunk,
  ChatStreamDelta,
  ChatToolCall,
  ChatUsage,
  StreamOptions,

  // Responses (OpenAI Responses API)
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesRequest,
  ResponsesResponse,
  ResponsesTool,
  ResponsesUsage,

  // Interactions (Google-compatible)
  InteractionsError,
  InteractionsFunction,
  InteractionsOutput,
  InteractionsRequest,
  InteractionsResponse,
  InteractionsTool,
  InteractionsUsage,

  // Embeddings
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsUsageInfo,

  // Messages
  MessagesMessage,
  MessagesRequest,
  MessagesResponse,
  MessagesResponseBlock,
  MessagesTool,
  MessagesUsage,

  // Models
  ModelInfo,
  ModelsResponse,

  // Generations
  GenerationConfig,

  // Parse
  ParseRequest,

  // Errors
  ErrorDetail,
  ErrorResponse,
} from 'task-api-sdk';
```

## TypeScript Configuration

This SDK is published as ESM with TypeScript declarations. Ensure your `tsconfig.json` is compatible:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

If using Node.js, ensure your `package.json` includes `"type": "module"` or use `.mts` file extensions.

## License

MIT

