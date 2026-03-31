import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("weather-check", {
  instructions: "Use the available tools to help the user",
  input: "What is the weather in Stockholm?",
  output_schema: z.object({
    answer: z.string(),
  }),
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: z.object({ city: z.string() }),
    },
  ],
});

console.log("Answer:", result.data.answer);
console.log("Tool calls:", result.meta);
