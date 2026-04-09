// Streaming — observe the agent's work as it happens
import { z } from "zod";
import { Agent, tool } from "../../src/index.js";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }) => ({
    city,
    temperature: Math.round(15 + Math.random() * 15),
    condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
  }),
});

const agent = new Agent({
  name: "weather-assistant",
  instructions: "You help users check the weather. Be concise.",
  tools: [getWeather],
});

// Pattern 1: Iterate events for live output
console.log("--- Streaming events ---");
const stream = agent.stream("What's the weather in Paris and Tokyo?");

for await (const event of stream) {
  switch (event.type) {
    case "iteration_start":
      console.log(`\n[Iteration ${event.iteration}]`);
      break;
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "tool_start":
      console.log(`  → Calling ${event.name}(${JSON.stringify(event.input)})`);
      break;
    case "tool_end":
      console.log(`  ← ${event.name} returned: ${JSON.stringify(event.output)} (${event.durationMs}ms)`);
      break;
  }
}

// Pattern 2: Get the final result after streaming
const result = await stream.result();
console.log("\n\n--- Final result ---");
console.log("Output:", result.output);
console.log("Iterations:", result.meta.iterations);
console.log("Tool calls:", result.meta.toolCalls.length);
console.log("Tokens:", result.meta.usage.totalTokens);
