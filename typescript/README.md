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

> **Note:** Zod v4 is required (`npm install zod@4`). The 3.x dual-mode package (`zod@3.25.x`) is not supported.

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
| 03c | [Server-side tools](./examples/getting-started/03c-server-side-tools.ts) | Server-side tool execution |
| 04a | [Generate image](./examples/getting-started/04a-generate-image.ts) | Image generation |
| 04b | [Describe image](./examples/getting-started/04b-describe-image.ts) | Vision / image description |
| 04c | [Edit image](./examples/getting-started/04c-edit-image.ts) | Image editing |
| 05 | [Audio](./examples/getting-started/05-audio.ts) | Text-to-speech + speech-to-text |
| 06 | [Video](./examples/getting-started/06-video.ts) | Video generation |
| 07 | [Embeddings](./examples/getting-started/07-embeddings.ts) | Vector embeddings + similarity |
| 08 | [Function mgmt](./examples/getting-started/08-function-management.ts) | List, get, revisions, delete |
| 09 | [Observability](./examples/getting-started/09-observability.ts) | Tracing, nested spans, sessions |
| 09b | [Manual tracing](./examples/getting-started/09b-manual-tracing.ts) | Manual span creation |
| 09c | [Traces](./examples/getting-started/09c-traces.ts) | List, get, and inspect traces |
| 10 | [Models](./examples/getting-started/10-models.ts) | List available models |
| 11 | [Realtime](./examples/getting-started/11-real-time.ts) | WebSocket URL for voice agents |
| 12 | [Knowledge base](./examples/getting-started/12-knowledge-base.ts) | Semantic search with knowledge bases |
| 13 | [Web tools](./examples/getting-started/13-web-tools.ts) | Web search and URL fetch (beta) |

### Agent Examples

| # | Example | What it shows |
|---|---|---|
| 00 | [First agent](./examples/agents/00-your-first-agent.ts) | Minimal agent, no tools |
| 01 | [Schema output](./examples/agents/01-agent-with-schema.ts) | Structured output with Zod |
| 02 | [Tools](./examples/agents/02-agent-with-tools.ts) | Tool definition and execution |
| 03 | [Streaming](./examples/agents/03-streaming.ts) | Stream events + final result |
| 04 | [Hooks logging](./examples/agents/04-hooks-logging.ts) | Lifecycle hooks for observability |
| 05 | [Hooks timing](./examples/agents/05-hooks-timing.ts) | Performance profiling |
| 06 | [Streaming + hooks](./examples/agents/06-streaming-with-hooks.ts) | Combined streaming and hooks |
| 07 | [Agent as tool](./examples/agents/07-agent-as-tool.ts) | Sub-agent composition |
| 08 | [Multi-agent](./examples/agents/08-multi-agent.ts) | Multi-agent orchestration |
| 09 | [MCP](./examples/agents/09-mcp-stdio.ts) | MCP tool provider integration |
| 10 | [Conversation](./examples/agents/10-conversation.ts) | Multi-turn stateful conversation |

Run a single example:

```bash
export OPPER_API_KEY="your-key"
npx tsx examples/getting-started/00-your-first-call.ts
```

Run all examples:

```bash
npm run examples
```

## Agent SDK

Build AI agents with tool use, streaming, multi-agent composition, and MCP integration.

```typescript
import { z } from "zod";
import { Agent, tool } from "opperai";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => `Sunny, 22°C in ${city}`,
});

const agent = new Agent({
  name: "weather-assistant",
  instructions: "You are a helpful weather assistant.",
  tools: [getWeather],
});

// Run — get the final result
const result = await agent.run("What's the weather in Paris?");
console.log(result.output);
console.log(result.meta.usage); // token usage across all iterations

// Stream — observe events as the agent works
const stream = agent.stream("What's the weather in Paris?");
for await (const event of stream) {
  if (event.type === "text_delta") process.stdout.write(event.text);
  if (event.type === "tool_start") console.log(`\nCalling ${event.name}...`);
}
const streamResult = await stream.result();
```

### Structured Output

```typescript
const agent = new Agent({
  name: "analyzer",
  instructions: "Analyze the sentiment of the input.",
  outputSchema: z.object({ label: z.string(), score: z.number() }),
});

const result = await agent.run("I love this product!");
result.output.label; // string — inferred from Zod schema
result.output.score; // number
```

### Multi-Agent Composition

```typescript
const researcher = new Agent({ name: "researcher", instructions: "...", tools: [webSearch] });
const writer = new Agent({
  name: "writer",
  instructions: "Write clear reports using research.",
  tools: [researcher.asTool("research", "Research a topic")],
});

const result = await writer.run("Write a report on AI agents");
```

### MCP Integration

```typescript
import { Agent, mcp } from "opperai";

const agent = new Agent({
  name: "file-assistant",
  instructions: "Help users manage files.",
  tools: [mcp({ name: "fs", transport: { type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] } })],
});
```

### Conversation (Multi-Turn)

```typescript
const conversation = agent.conversation();
const r1 = await conversation.send("My name is Alice");
const r2 = await conversation.send("What is my name?");
// r2.output → "Your name is Alice"
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
