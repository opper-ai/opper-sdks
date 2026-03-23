// Tools: non-streaming call with tool definitions
// Defines a tool and gets the result in a single call.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("sdk-test-tool-use", {
  input: "What is the current weather in Stockholm?",
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

console.log("Result:", result.data);
console.log("Meta:", result.meta);
