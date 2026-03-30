// Server-side tools: tools that run on the provider's infrastructure, not locally.
// Some providers offer built-in tools (e.g. Anthropic's web_search) that the model
// can invoke directly — no local execution needed. Just pass the tool definition
// with a `type` and `name`, and the provider handles the rest.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

console.log("── Anthropic server-side web_search tool ──");
console.log("Question: In one sentence, what is Opper AI?");
try {
  const r = await opper.call("test-server-side-search", {
    model: "anthropic/claude-sonnet-4.6",
    input_schema: z.object({ question: z.string() }),
    output_schema: z.object({
      answer: z.string().describe("Answer based on web search results"),
      sources: z.array(z.object({
        title: z.string(),
        url: z.string(),
      })).describe("Sources from web search"),
      // })).optional().describe("Sources from web search"),
    }),
    input: { question: "What is Opper AI?" },
    tools: [
      {
        // Server-side tool — Anthropic executes the search
        type: "web_search_20250305",
        name: "web_search",
      }
    ],
  });
  console.log("Answer:", r.data.answer);

  console.log("Result:", JSON.stringify(r.data, null, 2));
  console.log("Meta:", JSON.stringify(r.meta, null, 2));
} catch (e: any) {
  console.log("Error (expected if server-side tools not supported):", e.status, e.body || e.message);
}
