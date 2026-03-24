# Opper TypeScript SDK

TypeScript client for the [Opper](https://opper.ai) API.

## Install

```bash
npm install opperai
```

## Quick Start

```typescript
import { Opper } from "opperai";

const opper = new Opper(); // uses OPPER_API_KEY env var

// Call a function
const result = await opper.call("summarize", {
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ summary: z.string() }),
  input: { text: "Long article..." },
  model: "anthropic/claude-sonnet-4.6",
});
console.log(result.data.summary); // typed!

// Stream a function
for await (const chunk of opper.stream("summarize", { ... })) {
  if (chunk.type === "content") process.stdout.write(chunk.delta);
  if (chunk.type === "complete") console.log(chunk.data.summary);
}
```

## Schema Support

Pass [Zod](https://zod.dev) schemas (or any Standard Schema) for `input_schema`, `output_schema`, and tool `parameters` — the SDK resolves them to JSON Schema automatically and infers the response type.

```typescript
import { z } from "zod";

const result = await opper.call("extract", {
  output_schema: z.object({
    people: z.array(z.object({ name: z.string(), role: z.string().optional() })),
  }),
  input: { text: "Marie Curie was a physicist in Paris." },
});
result.data.people; // { name: string; role?: string }[] — inferred!
```

Raw JSON Schema and the `jsonSchema<T>()` helper also work. See [`01a-using-schemas.ts`](./examples/getting-started/01a-using-schemas.ts) and [`01b-using-other-schemas.ts`](./examples/getting-started/01b-using-other-schemas.ts).

## Observability

Wrap any block in `traced()` to group calls under a single trace span. Nesting works naturally.

```typescript
await opper.traced("my-pipeline", async () => {
  const a = await opper.call("step-1", { ... });
  const b = await opper.call("step-2", { input: a.data });
});
```

## Examples

| # | Example | What it shows |
|---|---|---|
| 00 | [First call](./examples/getting-started/00-your-first-call.ts) | Simplest possible call |
| 01a | [Zod schemas](./examples/getting-started/01a-using-schemas.ts) | Type-safe input/output with Zod |
| 01b | [Other schemas](./examples/getting-started/01b-using-other-schemas.ts) | jsonSchema helper, raw JSON Schema, generics |
| 02 | [Streaming](./examples/getting-started/02-stream.ts) | Stream deltas + complete event |
| 03a | [Tools (call)](./examples/getting-started/03a-tools-call.ts) | Tool definitions with call() |
| 03b | [Tools (stream)](./examples/getting-started/03b-tools-stream.ts) | Tool call chunks in streaming |
| 04a | [Generate image](./examples/getting-started/04a-generate-image.ts) | Image generation |
| 04b | [Describe image](./examples/getting-started/04b-describe-image.ts) | Vision / image description |
| 04c | [Edit image](./examples/getting-started/04c-edit-image.ts) | Image editing |
| 05 | [Audio](./examples/getting-started/05-audio.ts) | Text-to-speech + speech-to-text |
| 06 | [Video](./examples/getting-started/06-video.ts) | Video generation |
| 07 | [Embeddings](./examples/getting-started/07-embeddings.ts) | Vector embeddings + similarity |
| 08 | [Function mgmt](./examples/getting-started/08-function-management.ts) | List, get, revisions, delete |
| 09 | [Observability](./examples/getting-started/09-observability.ts) | Tracing, nested spans, sessions |
| 10 | [Models](./examples/getting-started/10-models.ts) | List available models |
| 11 | [Realtime](./examples/getting-started/11-real-time.ts) | WebSocket URL for voice agents |

Run a single example:

```bash
export OPPER_API_KEY="your-key"
npx tsx examples/getting-started/00-your-first-call.ts
```

Run all examples:

```bash
npm run examples
```

## Configuration

| Parameter | Default | Env Var |
|---|---|---|
| `apiKey` | — | `OPPER_API_KEY` |
| `baseUrl` | `https://api.opper.ai` | `OPPER_BASE_URL` |
| `headers` | `{}` | — |

## Error Handling

```typescript
import { ApiError } from "opperai";

try {
  await opper.call("my-fn", { input: "hello" });
} catch (e) {
  if (e instanceof ApiError) {
    console.error(e.status, e.body);
  }
}
```

## Requirements

- Node.js 18+
- TypeScript 5.0+

## License

MIT
