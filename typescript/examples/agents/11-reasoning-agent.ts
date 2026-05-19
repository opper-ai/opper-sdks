// Agent with reasoningEffort and reasoningSummary (added in 4.0.0-beta.13).
//
// Both fields are accepted on Agent construction and on per-run RunOptions.
// Per-run options win over the agent's defaults.
import { Agent } from "../../src/agent/index.js";

const agent = new Agent({
  name: "reasoning-agent",
  instructions: "You are a careful thinker. Show your work step by step.",
  model: "openai/gpt-5.1",
  reasoningEffort: "low",
  reasoningSummary: "auto",
});

const result = await agent.run(
  "A bat and a ball cost $1.10. The bat costs $1.00 more than the ball. " +
    "How much does the ball cost?",
);

console.log("Output:", result.output);
console.log("Reasoning tokens:", result.meta.usage.reasoningTokens);

// ── Override at run-time ────────────────────────────────────────────────────
const overridden = await agent.run("What is 17 * 24? Just give the number.", {
  reasoningEffort: "medium",
});
console.log("\nOverridden output:", overridden.output);
