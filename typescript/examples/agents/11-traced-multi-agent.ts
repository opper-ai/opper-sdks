// Traced multi-agent — Agent traces automatically, no Opper class needed.
// All LLM calls, tool executions, and sub-agent runs appear as a trace tree
// in the Opper dashboard. Use `traceName` to customize how agents appear.
import { z } from "zod";
import { Agent, tool } from "../../src/index.js";

const analyzeMarket = tool({
  name: "analyze_market",
  description: "Analyze the market for a product category",
  parameters: z.object({ category: z.string() }),
  execute: async ({ category }) => ({
    category,
    trends: ["AI-assisted development", "context-aware tooling", "agentic workflows"],
    competitors: ["Cursor", "Windsurf", "Copilot"],
    gap: "Deep repo-wide context without manual configuration",
  }),
});

const analyzeAudience = tool({
  name: "analyze_audience",
  description: "Analyze the target audience",
  parameters: z.object({ product: z.string() }),
  execute: async ({ product }) => ({
    product,
    primary: "Professional developers at mid-to-large companies",
    pain_points: ["Context switching", "Debugging across files", "Slow onboarding to new codebases"],
  }),
});

// traceName overrides the function name in traces (default is `name`)
// In the dashboard these show as: editorial/researcher, editorial/writer
const researcher = new Agent({
  name: "researcher",
  traceName: "editorial/researcher",
  instructions: "You research markets and audiences. Use your tools, then summarize findings concisely.",
  tools: [analyzeMarket, analyzeAudience],
});

const writer = new Agent({
  name: "writer",
  traceName: "editorial/writer",
  instructions: "You write marketing copy. Given research, produce a tagline and short description.",
});

const coordinator = new Agent({
  name: "coordinator",
  traceName: "editorial/coordinator",
  instructions: `You coordinate an editorial pipeline:
1. First delegate research to the "research" tool
2. Then delegate writing to the "writer" tool with the research results
Be concise.`,
  tools: [
    researcher.asTool({ name: "research", description: "Research a product's market and audience" }),
    writer.asTool({ name: "writer", description: "Write marketing copy based on research" }),
  ],
});

console.log("Running traced multi-agent pipeline...\n");
const result = await coordinator.run("Write a tagline + description for 'FlowCode', an AI-powered code editor");

console.log("Output:", result.output);
console.log("\nIterations:", result.meta.iterations);
console.log("Tool calls:", result.meta.toolCalls.length);
console.log("Tokens:", result.meta.usage.totalTokens);
console.log("\nCheck the Opper dashboard for the trace tree!");
