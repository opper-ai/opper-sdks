// Streaming + Hooks — combine live output with lifecycle observability
// Hooks fire alongside stream events, so you can log/trace without parsing the stream yourself.
import { z } from "zod";
import { Agent, tool } from "../../src/index.js";
import type { Hooks } from "../../src/index.js";

const calculate = tool({
  name: "calculate",
  description: "Evaluate a math expression and return the result",
  parameters: z.object({
    expression: z.string().describe("A math expression like '2 + 2' or '100 * 1.15'"),
  }),
  execute: async ({ expression }) => {
    // Simple safe eval for basic math
    const result = Function(`"use strict"; return (${expression})`)();
    return { expression, result };
  },
});

// Hooks run behind the scenes — they don't interfere with streaming
const hooks: Hooks = {
  onAgentStart: ({ agent }) => {
    console.log(`[hook] Agent "${agent}" started\n`);
  },
  onAgentEnd: ({ result, error }) => {
    if (error) {
      console.log(`\n[hook] Agent failed: ${error.message}`);
    } else {
      console.log(`\n[hook] Agent done — ${result!.meta.iterations} iteration(s), ${result!.meta.usage.totalTokens} tokens`);
    }
  },
  onToolStart: ({ name, input }) => {
    console.log(`\n[hook] Tool "${name}" starting: ${JSON.stringify(input)}`);
  },
  onToolEnd: ({ name, output, durationMs }) => {
    console.log(`[hook] Tool "${name}" done in ${durationMs}ms: ${JSON.stringify(output)}\n`);
  },
};

const agent = new Agent({
  name: "math-assistant",
  instructions: "You help with math. Use the calculate tool for any computation. Show your work briefly.",
  tools: [calculate],
  hooks,
});

// Stream events for live text output
const stream = agent.stream("What is 15% tip on a $85 dinner bill? And what about 20%?");

for await (const event of stream) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "iteration_start":
      console.log(`\n--- Iteration ${event.iteration} ---`);
      break;
  }
}

// Final result is still available
const result = await stream.result();
console.log(`\nTool calls: ${result.meta.toolCalls.map((c) => c.name).join(", ")}`);
