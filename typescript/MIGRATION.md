# Migrating to `opperai` 4.0

This guide covers the breaking changes between:

- **`opperai` 3.x** (old core SDK, Speakeasy-generated)
- **`@opperai/agents` 0.x** (old separate agent SDK)

and the new unified **`opperai` 4.0** in this monorepo.

If you only used `opperai` 3.x (no agents), you can skip the *Agents* section.

## TL;DR

1. `@opperai/agents` is gone. Agents now live inside `opperai`:
   `import { Agent, tool } from '@opperai/agents'` →
   `import { Agent, tool } from 'opperai'`.
2. `new Opper({ httpBearer })` → `new Opper({ apiKey })`.
3. `opper.call(...)` takes the function name as a positional argument and
   returns `{ data, meta }` instead of the old Speakeasy envelope.
4. `agent.process(...)` and `agent.streamProcess(...)` are gone — use
   `agent.run(...)` and `agent.stream(...)`. Result shape is
   `{ output, meta }` with camelCase usage fields.
5. `zod` and `@modelcontextprotocol/sdk` are now **optional peer
   dependencies** — install them explicitly if you use Zod schemas or MCP
   tools.

## Install & imports

```diff
- npm install opperai@3 @opperai/agents
+ npm install opperai@4
+ # if you use Zod schemas:
+ npm install zod
+ # if you use MCP tools:
+ npm install @modelcontextprotocol/sdk
```

```diff
- import { Opper } from 'opperai';
- import { Agent, tool, createFunctionTool } from '@opperai/agents';
+ import { Opper, Agent, tool, mcp } from 'opperai';
```

**Node requirement:** the package now targets `node >= 18` (was implicit
before; `@opperai/agents` required 20).

## Client initialization

```diff
- const opper = new Opper({ httpBearer: process.env.OPPER_API_KEY });
+ const opper = new Opper({ apiKey: process.env.OPPER_API_KEY });
+ // or just: new Opper()  — picks up OPPER_API_KEY + OPPER_BASE_URL
```

The old Speakeasy options (`serverURL`, `serverIdx`, `retryConfig`, etc.)
have collapsed into `{ apiKey, baseUrl, headers }`.

## `opper.call()` / `opper.stream()`

### Positional function name, new response shape

```diff
- const res = await opper.call({
-   name: 'summarize',
-   instructions: 'Summarize the article',
-   input: { text: '...' },
-   outputSchema: { /* ... */ },
- });
- const summary = res.functionCallResponse?.jsonPayload?.summary;
+ const res = await opper.call('summarize', {
+   instructions: 'Summarize the article',
+   input: { text: '...' },
+   output_schema: z.object({ summary: z.string() }),
+ });
+ const summary = res.data.summary;   // typed!
+ const usage = res.meta?.usage;
```

Request fields are now consistently `snake_case` to match the wire format
(`output_schema`, `input_schema`, `parent_span_id`, `max_tokens`, etc.).

### Standard Schema support

`output_schema` / `input_schema` / tool `parameters` now accept any Standard
Schema V1 implementation (Zod v4, Valibot, ArkType, …) **or** raw JSON
Schema. When a Standard Schema is passed, the result type is inferred.

### Streaming: direct async iterable, typed chunks

```diff
- const stream = await opper.stream({ name: 'summarize', input: { text: '...' } });
- for await (const event of stream.result) {
-   if (event.data?.delta) process.stdout.write(event.data.delta);
- }
+ for await (const chunk of opper.stream('summarize', { input: { text: '...' } })) {
+   if (chunk.type === 'content') process.stdout.write(chunk.delta);
+   if (chunk.type === 'done') console.log(chunk.usage);
+ }
```

`opper.stream(...)` is now an `AsyncGenerator<StreamChunk>` — there is no
more `.result` wrapper. Chunks are a discriminated union on `.type`
(`content | tool_call_start | tool_call_delta | done | error | complete`).

### Removed `call()` parameters

- `examples` — bake examples into `instructions`.
- `configuration` — no replacement.
- `tags` — attach via spans (`opper.spans.create({ ..., tags })`).

## Agents

### Package and imports

```diff
- import { Agent, tool, createFunctionTool } from '@opperai/agents';
+ import { Agent, tool, mcp } from 'opperai';
```

### Constructor: `opperConfig` → `client`

```diff
- const agent = new Agent({
-   name: 'assistant',
-   instructions: 'Be helpful.',
-   tools: [getWeather],
-   opperConfig: { apiKey: '...', baseUrl: '...' },
-   verbose: true,
- });
+ const agent = new Agent({
+   name: 'assistant',
+   instructions: 'Be helpful.',
+   tools: [getWeather],
+   client: { apiKey: '...', baseUrl: '...' },
+ });
```

Shortcut: `opper.agent({...})` builds an `Agent` that inherits the client
config from an existing `Opper` instance.

### `process()` / `streamProcess()` are gone — use `run()` / `stream()`

```diff
- const output = await agent.process('Hello!');
- // or:
- const { result, usage } = await agent.run('Hello!');
+ const result = await agent.run('Hello!');
+ console.log(result.output);
+ console.log(result.meta.usage.inputTokens, result.meta.usage.outputTokens);
+ console.log(result.meta.iterations, result.meta.toolCalls);
```

Usage fields moved to **camelCase** (`inputTokens`, `outputTokens`,
`totalTokens`, `cachedTokens`, `reasoningTokens`).

### Tool creation: one `tool(...)` factory

`@tool` (decorator) and `createFunctionTool(...)` are both gone. Use a
single `tool({...})` factory:

```diff
- import { createFunctionTool } from '@opperai/agents';
- import { z } from 'zod';
-
- const getWeather = createFunctionTool({
-   name: 'get_weather',
-   description: 'Get weather',
-   parameters: z.object({ city: z.string() }),
-   execute: async ({ city }) => ({ temp: 22 }),
- });
+ import { tool } from 'opperai';
+ import { z } from 'zod';
+
+ const getWeather = tool({
+   name: 'get_weather',
+   description: 'Get weather',
+   parameters: z.object({ city: z.string() }),
+   execute: async ({ city }) => ({ temp: 22 }),  // return raw values
+ });
```

Tool `execute()` now returns raw values — no more `ToolResult<T>` wrapper.
The SDK collects metadata (usage, timings) automatically and surfaces it in
`result.meta.toolCalls`.

### Hooks: unified `hooks` object

```diff
- const agent = new Agent({
-   onStreamStart: () => { ... },
-   onStreamChunk: (chunk) => { ... },
-   onStreamEnd: () => { ... },
-   onStreamError: (err) => { ... },
- });
+ import { mergeHooks } from 'opperai';
+
+ const agent = new Agent({
+   hooks: {
+     onLLMCall: (ctx) => { ... },
+     onToolCall: (ctx) => { ... },
+     onToolSuccess: (ctx) => { ... },
+     onToolError: (ctx) => { ... },
+   },
+ });
+ // Compose multiple hook bundles: new Agent({ hooks: mergeHooks(a, b) })
```

### Streaming agents

```typescript
for await (const event of agent.stream('What is the weather?')) {
  if (event.type === 'text_delta') process.stdout.write(event.delta);
  if (event.type === 'tool_start') console.log(`\n[tool] ${event.name}`);
  if (event.type === 'result') console.log('\nDone');
}
```

### Multi-turn conversations (new)

```typescript
const convo = agent.conversation();
await convo.send('My name is Alice.');
const r = await convo.send('What is my name?');
console.log(r.output); // references "Alice"
```

### Generic signature change

```diff
- const agent = new Agent<InputType, OutputType>({ ... });
+ const agent = new Agent<OutputType>({ outputSchema: z.object({...}) });
+ // Output type is inferred from outputSchema; input is always
+ // string | ORInputItem[].
```

## Functions CRUD

```diff
- await opper.functions.call({ name: 'task', requestBody: { ... } });
+ await opper.functions.run('task', { input: ... });
```

Function creation is now **source-based**: `opper.functions.create({ name, source })`
replaces the old `instructions` + `inputSchema` + `outputSchema` + `model`
+ `configuration` bag. The per-function `revisions.*` sub-client is gone.

## Tracing / spans

Prefer `opper.traced(...)` over raw `spans.create` / `spans.update`:

```typescript
const result = await opper.traced('pipeline', async (span) => {
  const r1 = await opper.call('step1', { input: 'hello' });
  return opper.call('step2', { input: r1.data });
});
```

Nested `call`, `stream`, and `agent.run` invocations automatically pick up
the current trace context — you do not need to thread `parent_span_id`
through manually. Where you still pass it explicitly, the field is
`parent_span_id` (was `parentSpanUuid` in 3.x).

## Errors

```diff
- import {
-   BadRequestError,
-   UnauthorizedError,
-   NotFoundError,
-   RequestValidationError,
-   APIError,
- } from 'opperai/models/errors';
+ import {
+   ApiError,                // was APIError
+   BadRequestError,
+   AuthenticationError,     // was UnauthorizedError
+   NotFoundError,
+   RateLimitError,          // new
+   InternalServerError,     // new
+ } from 'opperai';
+ import { AgentError, MaxIterationsError, AbortError } from 'opperai';
```

`RequestValidationError` is gone — 422 responses now raise `BadRequestError`.

## Removed APIs

The following client namespaces have been **intentionally removed** from 4.0
and have no drop-in replacement yet:

- `opper.datasets.*`
- `opper.evaluations.*`
- `opper.analytics.*`
- `opper.languageModels.*`
- `opper.ocr.*`
- `opper.rerank.*` (the endpoint; `opper.knowledge.query({ ..., rerank: true })`
  still exists as a flag)
- OpenAI-compatibility sub-client
- Per-function `revisions.*`

If you need these while they are reworked, call the REST API directly:

```typescript
const r = await fetch('https://api.opper.ai/v3/datasets/...', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPPER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ /* ... */ }),
});
```

## Optional peer dependencies

`zod` and `@modelcontextprotocol/sdk` moved from `dependencies` to optional
`peerDependencies`. Existing projects using Zod or MCP need one explicit
`npm install`:

```bash
npm install zod                        # if you use Zod schemas
npm install @modelcontextprotocol/sdk  # if you use MCP tools (mcp.stdio/sse/http)
```
