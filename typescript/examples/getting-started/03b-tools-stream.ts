// Tools: streaming with tool_call chunks
// Defines a tool and streams the response to see tool_call_start and tool_call_delta chunks.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

console.log("Streaming with tools:");

for await (const chunk of opper.stream("sdk-test-tool-use-stream", {
  input_schema: z.object({
    question: z.string().describe("The user's question"),
  }),
  output_schema: z.object({
    answer: z.string().optional().describe("The assistant's text response"),
    tool_calls: z.array(z.object({
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()),
    })).optional().describe("Tool calls requested by the model"),
  }),
  input: { question: "What is the current weather in Stockholm?" },
  model: "anthropic/claude-sonnet-4.6",
  tools: [
    {
      name: "get_weather",
      description: "Get the current weather for a city",
      parameters: z.object({
        city: z.string().describe("City name"),
        unit: z.enum(["celsius", "fahrenheit"]).optional().describe("Temperature unit"),
      }),
    },
  ],
})) {
  switch (chunk.type) {
    case "tool_call_start":
      console.log(`\n[tool_call_start] name=${chunk.tool_call_name} id=${chunk.tool_call_id}`);
      break;
    case "tool_call_delta":
      process.stdout.write(chunk.tool_call_args);
      break;
    case "content":
      process.stdout.write(chunk.delta);
      break;
    case "done":
      console.log("\n[done]", chunk.usage);
      break;
    case "complete":
      console.log("[complete] data:", JSON.stringify(chunk.data, null, 2));
      break;
    case "error":
      console.error("[error]", chunk.error);
      break;
  }
}
