import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("agent-round", {
  instructions: "Use the available tools to help the user",
  input: {
    message: "What is the weather in Stockholm?",
    tools: [
      {
        name: "get_weather",
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      },
    ],
  },
  output_schema: z.object({
    message: z.string(),
    tool_call: z.object({
      name: z.string(),
      arguments: z.record(z.unknown()),
    }),
  }),
});

console.log(result.data);
