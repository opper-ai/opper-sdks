// Tools: non-streaming call with tool definitions
// Defines a tool and gets the result including any tool_calls the LLM wants to make.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("sdk-test-tool-use", {
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
});

console.log("Answer:", result.data.answer);
console.log("Tool calls:", JSON.stringify(result.data.tool_calls, null, 2));
