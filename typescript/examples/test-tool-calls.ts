// Test: verify that tool_calls are surfaced in the response
import { z } from "zod";
import { Opper } from "../src/index.js";

const OPPER_BASE_URL = "http://localhost:8080";
const opper = new Opper({
  baseUrl: process.env.OPPER_BASE_URL || "http://localhost:8080",
  apiKey: process.env.OPPER_LOCAL_KEY || process.env.OPPER_API_KEY,
});

// Test 1: output_schema includes tool_calls
console.log("── Test 1: output_schema with tool_calls field ──");
const r1 = await opper.call("test-tools-with-schema", {
  model: "anthropic/claude-sonnet-4.6",
  input_schema: z.object({ question: z.string() }),
  output_schema: z.object({
    answer: z.string().optional(),
    tool_calls: z.array(z.object({
      name: z.string(),
      arguments: z.object({}).loose(),
    })).optional(),
  }),
  input: { question: "What is the weather in Stockholm?" },
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: z.object({ city: z.string() }),
    },
  ],
});
console.log("Result:", JSON.stringify(r1.data, null, 2));
console.log("Meta:", JSON.stringify(r1.meta, null, 2));

// Test 2: no output_schema — raw response
console.log("\n── Test 2: no output_schema ──");
try {
  const r2 = await opper.call("test-tools-no-schema-" + Date.now(), {
    model: "anthropic/claude-sonnet-4.6",
    input_schema: z.object({ question: z.string() }),
    input: { question: "What is the weather in Stockholm?" },
    tools: [
      {
        name: "get_weather",
        description: "Get current weather for a city",
        parameters: z.object({ city: z.string() }),
      },
    ],
  });
  console.log("Result:", JSON.stringify(r2.data, null, 2));
  console.log("Meta:", JSON.stringify(r2.meta, null, 2));
} catch (e: any) {  console.log("Error (expected if output_schema is required for tools):", e.status, e.body || e.message);
}

// Test 3: Anthropic server-side web_search tool
// This requires the task-api Anthropic adapter to pass through server-side tool types.
// Tool format: { type: "web_search_20250305", name: "web_search" } — no input_schema.
// The search is executed by Anthropic's infrastructure, not by the caller.
console.log("\n── Test 3: Anthropic server-side web_search tool ──");
try {
  const r3 = await opper.call("test-server-side-search-" + Date.now(), {
    model: "anthropic/claude-sonnet-4.6",
    input_schema: z.object({ question: z.string() }),
    output_schema: z.object({
      answer: z.string().describe("Answer based on web search results"),
      sources: z.array(z.object({
        title: z.string(),
        url: z.string(),
      })).optional().describe("Sources from web search"),
    }),
    input: { question: "What is Opper AI?" },
    tools: [
      {
        // Server-side tool — Anthropic executes the search
        type: "web_search_20250305",
        name: "web_search",
      } as any, // type assertion needed since SDK Tool type expects `parameters`
    ],
  });
  console.log("Result:", JSON.stringify(r3.data, null, 2));
  console.log("Meta:", JSON.stringify(r3.meta, null, 2));
} catch (e: any) {
  console.log("Error (expected if server-side tools not supported):", e.status, e.body || e.message);
}
