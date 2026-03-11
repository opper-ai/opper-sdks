# Opper TypeScript SDK

TypeScript client for the [Opper](https://opper.ai) API — execute functions, stream results, and build AI agents.

## Install

```bash
npm install opperai
```

## Quick Start

```typescript
import { Opper } from 'opperai';

// Uses OPPER_API_KEY and OPPER_BASE_URL env vars
const client = new Opper();

// Or pass config explicitly
const client = new Opper({ apiKey: 'op-...', baseUrl: 'https://api.opper.ai' });

// Run a function
const result = await client.run('my-function', {
  input_schema: { type: 'object', properties: { question: { type: 'string' } } },
  output_schema: { type: 'object', properties: { answer: { type: 'string' } } },
  input: { question: 'What is 2+2?' },
  model: 'anthropic/claude-sonnet-4-6',
});
console.log(result.output);

// Stream a function
for await (const chunk of client.stream('my-function', { ... })) {
  if (chunk.type === 'content') process.stdout.write(chunk.delta);
  if (chunk.type === 'done') console.log(chunk.usage);
}
```

## Configuration

| Parameter | Type | Default | Env Var |
|---|---|---|---|
| `apiKey` | string | — | `OPPER_API_KEY` |
| `baseUrl` | string | `https://api.opper.ai` | `OPPER_BASE_URL` |
| `headers` | `Record<string, string>` | `{}` | — |

If `apiKey` is not provided, the client reads from `OPPER_API_KEY`. If neither is set, construction throws.

## Client API

### Top-Level Convenience

| Method | Description |
|---|---|
| `client.run(name, request)` | Execute a function (shortcut for `client.functions.runFunction`) |
| `client.stream(name, request)` | Stream a function execution (shortcut for `client.functions.streamFunction`) |

### `client.functions` — Function Management & Execution

| Method | HTTP | Description |
|---|---|---|
| `runFunction(name, body)` | `POST /v3/functions/{name}/run` | Execute a function |
| `streamFunction(name, body)` | `POST /v3/functions/{name}/stream` | Stream execution (SSE → `AsyncGenerator<StreamChunk>`) |
| `listFunctions()` | `GET /v3/functions` | List functions |
| `getFunction(name)` | `GET /v3/functions/{name}` | Get function details |
| `updateFunction(name, body)` | `PUT /v3/functions/{name}` | Update function source |
| `deleteFunction(name)` | `DELETE /v3/functions/{name}` | Delete function |
| `createRealtimeFunction(name, body)` | `POST /v3/functions/{name}/realtime` | Create voice agent |
| `listRevisions(name)` | `GET /v3/functions/{name}/revisions` | List revisions |
| `getRevision(name, id)` | `GET /v3/functions/{name}/revisions/{id}` | Get revision |
| `revertRevision(name, id)` | `POST /v3/functions/{name}/revisions/{id}/revert` | Revert to revision |
| `createExample(name, body)` | `POST /v3/functions/{name}/examples` | Create example |
| `createExamplesBatch(name, body)` | `POST /v3/functions/{name}/examples/batch` | Batch create examples |
| `listExamples(name, params?)` | `GET /v3/functions/{name}/examples` | List examples |
| `deleteExample(name, uuid)` | `DELETE /v3/functions/{name}/examples/{uuid}` | Delete example |
| `getRealtimeWebSocketUrl(name)` | — | Get WebSocket URL |

### `client.spans` — Observability

| Method | HTTP | Description |
|---|---|---|
| `create(body)` | `POST /v3/spans` | Create a trace span |
| `update(id, body)` | `PATCH /v3/spans/{id}` | Update a span |

### `client.generations` — Generation Records

| Method | HTTP | Description |
|---|---|---|
| `listGenerations(params?)` | `GET /v3/generations` | List generations |
| `getGeneration(id)` | `GET /v3/generations/{id}` | Get generation |
| `deleteGeneration(id)` | `DELETE /v3/generations/{id}` | Delete generation |

### `client.embeddings` — OpenAI-compatible Embeddings

| Method | HTTP | Description |
|---|---|---|
| `createEmbedding(body)` | `POST /v3/compat/embeddings` | Create embeddings |

### `client.models` — Available Models (no auth)

| Method | HTTP | Description |
|---|---|---|
| `listModels()` | `GET /v3/models` | List available models |

### `client.system` — Health (no auth)

| Method | HTTP | Description |
|---|---|---|
| `healthCheck()` | `GET /health` | Health check |

## Streaming

The `streamFunction` method returns `AsyncGenerator<StreamChunk>`. Each chunk has a `type` field:

| Type | Key Fields | Description |
|---|---|---|
| `content` | `delta` | Incremental text |
| `tool_call_start` | `tool_call_id`, `tool_call_name`, `tool_call_index` | New tool call |
| `tool_call_delta` | `tool_call_index`, `tool_call_args` | Tool call argument fragment |
| `done` | `usage` | Stream complete with usage metadata |
| `error` | `error` | Server-side error |

## Error Handling

```typescript
import { Opper, ApiError } from 'opperai';

try {
  await client.run('missing-fn', { ... });
} catch (e) {
  if (e instanceof ApiError) {
    console.error(e.status, e.statusText, e.body);
  }
}
```

## Examples

See [`examples/getting-started/`](./examples/getting-started/) for working examples.

Run all examples as a sanity check:

```bash
export OPPER_API_KEY="your-key"
npm run examples
```

## Requirements

- Node.js 18+ (native `fetch`)
- TypeScript 5.0+

## Development

```bash
npm test        # Run tests
npm run lint    # Lint with Biome
npm run format  # Format with Biome
npm run build   # Compile TypeScript
npm run examples # Run all examples against live API
```

See [PLAN.md](./PLAN.md) for development status.

## License

MIT
