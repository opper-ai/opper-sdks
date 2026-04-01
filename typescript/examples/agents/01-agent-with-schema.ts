// Agent with structured output — use a Zod schema to get typed results
import { z } from "zod";
import { Agent } from "../../src/agent/index.js";

const SummarySchema = z.object({
  title: z.string().describe("A short title for the summary"),
  key_points: z.array(z.string()).describe("3-5 key points"),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("Overall sentiment"),
});

const agent = new Agent({
  name: "summarizer",
  instructions: "You summarize text and extract structured information.",
  outputSchema: SummarySchema,
});

const text = `
  The new product launch exceeded all expectations. Customer reviews have been
  overwhelmingly positive, with particular praise for the intuitive design and
  performance improvements. Sales figures are up 40% compared to last quarter,
  and support tickets have actually decreased despite the larger user base.
`;

const result = await agent.run(`Summarize this text: ${text}`);

// result.output is automatically typed — no cast needed!
console.log("Title:", result.output.title);
console.log("Key points:");
for (const point of result.output.key_points) {
  console.log(" -", point);
}
console.log("Sentiment:", result.output.sentiment);
console.log("Iterations:", result.meta.iterations);
