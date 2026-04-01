// Hooks — observe every lifecycle event during an agent run
// Hooks let you log, trace, or measure without touching the agent logic.
import { z } from "zod";
import { Agent, tool } from "../../src/agent/index.js";
import type { Hooks } from "../../src/agent/types.js";

const lookupCity = tool({
  name: "lookup_city",
  description: "Get facts about a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }) => ({
    city,
    population: city === "Paris" ? "2.1M" : "13.9M",
    country: city === "Paris" ? "France" : "Japan",
  }),
});

// A simple hooks object that logs every lifecycle event
const loggingHooks: Hooks = {
  onAgentStart: ({ agent, input }) => {
    console.log(`\n🚀 Agent "${agent}" started with input: ${typeof input === "string" ? input : "[items]"}`);
  },
  onAgentEnd: ({ agent, result, error }) => {
    if (error) {
      console.log(`\n💥 Agent "${agent}" failed: ${error.message}`);
    } else {
      console.log(`\n✅ Agent "${agent}" completed in ${result!.meta.iterations} iteration(s)`);
      console.log(`   Tokens: ${result!.meta.usage.totalTokens} total (${result!.meta.usage.inputTokens} in, ${result!.meta.usage.outputTokens} out)`);
    }
  },
  onIterationStart: ({ iteration }) => {
    console.log(`\n--- Iteration ${iteration} ---`);
  },
  onLLMCall: ({ iteration }) => {
    console.log(`  📤 Sending request to LLM (iteration ${iteration})`);
  },
  onLLMResponse: ({ iteration, response }) => {
    const tokens = response.usage
      ? `${response.usage.total_tokens} tokens`
      : "unknown tokens";
    console.log(`  📥 Got response (${tokens})`);
  },
  onToolStart: ({ name, input }) => {
    console.log(`  🔧 Tool "${name}" called with: ${JSON.stringify(input)}`);
  },
  onToolEnd: ({ name, output, error, durationMs }) => {
    if (error) {
      console.log(`  ❌ Tool "${name}" failed: ${error} (${durationMs}ms)`);
    } else {
      console.log(`  ✔  Tool "${name}" returned: ${JSON.stringify(output)} (${durationMs}ms)`);
    }
  },
};

const agent = new Agent({
  name: "city-expert",
  instructions: "You answer questions about cities. Use the lookup_city tool to get facts. Be concise.",
  tools: [lookupCity],
  hooks: loggingHooks,
});

const result = await agent.run("Compare Paris and Tokyo — which is bigger?");

console.log("\nFinal answer:", result.output);
