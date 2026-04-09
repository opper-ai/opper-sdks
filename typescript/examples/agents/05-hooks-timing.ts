// Hooks for performance measurement — track LLM latency and tool execution time
// This pattern is useful for building dashboards or sending metrics to your observability stack.
import { z } from "zod";
import { Agent, tool } from "../../src/index.js";
import type { Hooks } from "../../src/index.js";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }) => {
    // Simulate variable latency
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    return {
      city,
      temperature: Math.round(15 + Math.random() * 15),
      condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
    };
  },
});

// Collect timing metrics in a structured way
interface Metrics {
  llmCalls: Array<{ iteration: number; durationMs: number }>;
  toolCalls: Array<{ name: string; durationMs: number }>;
  totalDurationMs: number;
}

function createTimingHooks(): { hooks: Hooks; metrics: Metrics } {
  const metrics: Metrics = { llmCalls: [], toolCalls: [], totalDurationMs: 0 };
  const timers = new Map<string, number>();

  const hooks: Hooks = {
    onAgentStart: () => {
      timers.set("agent", Date.now());
    },
    onAgentEnd: () => {
      metrics.totalDurationMs = Date.now() - (timers.get("agent") ?? Date.now());
    },
    onLLMCall: ({ iteration }) => {
      timers.set(`llm:${iteration}`, Date.now());
    },
    onLLMResponse: ({ iteration }) => {
      const start = timers.get(`llm:${iteration}`);
      if (start) {
        metrics.llmCalls.push({ iteration, durationMs: Date.now() - start });
      }
    },
    onToolEnd: ({ name, durationMs }) => {
      metrics.toolCalls.push({ name, durationMs });
    },
  };

  return { hooks, metrics };
}

const { hooks, metrics } = createTimingHooks();

const agent = new Agent({
  name: "weather-agent",
  instructions: "You help users check the weather. Use the get_weather tool. Be concise.",
  tools: [getWeather],
  hooks,
});

const result = await agent.run("What's the weather in Berlin?");

// Print structured metrics
console.log("=== Performance Metrics ===\n");
console.log(`Total duration: ${metrics.totalDurationMs}ms`);
console.log(`Iterations: ${result.meta.iterations}`);
console.log(`\nLLM calls:`);
for (const call of metrics.llmCalls) {
  console.log(`  Iteration ${call.iteration}: ${call.durationMs}ms`);
}
console.log(`\nTool calls:`);
for (const call of metrics.toolCalls) {
  console.log(`  ${call.name}: ${call.durationMs}ms`);
}
console.log(`\nToken usage:`);
console.log(`  Input:  ${result.meta.usage.inputTokens}`);
console.log(`  Output: ${result.meta.usage.outputTokens}`);
console.log(`  Total:  ${result.meta.usage.totalTokens}`);
console.log(`\nAnswer: ${result.output}`);
