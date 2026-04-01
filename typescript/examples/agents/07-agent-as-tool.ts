// Agent as tool — wrap a specialist agent so another agent can call it
// asTool() is the building block for multi-agent composition.
import { Agent } from "../../src/agent/index.js";

// A specialist agent that only knows about geography
const geographer = new Agent({
  name: "geographer",
  instructions:
    "You are a geography expert. Answer geography questions precisely and concisely. " +
    "Include key facts like population, area, or notable features when relevant.",
});

// A coordinator agent that delegates geography questions to the specialist
const coordinator = new Agent({
  name: "coordinator",
  instructions:
    "You are a helpful assistant. When the user asks a geography question, " +
    "use the geography_expert tool to get an authoritative answer, then present it " +
    "in a friendly way. For non-geography questions, answer directly.",
  tools: [
    geographer.asTool({
      name: "geography_expert",
      description: "Ask a geography expert a question. Pass the full question as input.",
    }),
  ],
});

const result = await coordinator.run("What are the three largest countries by area?");

console.log("Answer:", result.output);
console.log("\nCoordinator iterations:", result.meta.iterations);
console.log("Coordinator tokens:", result.meta.usage.totalTokens);

// The sub-agent's result is captured in the tool call output
const subAgentCall = result.meta.toolCalls.find((c) => c.name === "geography_expert");
if (subAgentCall) {
  const subResult = subAgentCall.output as { output: string; iterations: number; usage: { totalTokens: number } };
  console.log("\nSub-agent output:", subResult.output);
  console.log("Sub-agent iterations:", subResult.iterations);
  console.log("Sub-agent tokens:", subResult.usage.totalTokens);
}
