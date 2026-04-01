// Multi-agent — a coordinator dispatches to specialist agents that have their own tools
// Each specialist focuses on one domain with dedicated tools; the coordinator orchestrates.
import { z } from "zod";
import { Agent, tool } from "../../src/agent/index.js";
import type { Hooks } from "../../src/agent/types.js";

// ---------------------------------------------------------------------------
// Tools for the specialists
// ---------------------------------------------------------------------------

// The researcher can look up market data
const lookupMarketData = tool({
  name: "lookup_market_data",
  description: "Look up market data for a product category",
  parameters: z.object({
    category: z.string().describe("Product category to research"),
  }),
  execute: async ({ category }) => ({
    category,
    market_size: "$4.2B",
    growth_rate: "12% YoY",
    top_competitors: ["VS Code", "Cursor", "Windsurf"],
    trend: "AI-assisted coding tools growing 3x faster than traditional IDEs",
  }),
});

const lookupAudience = tool({
  name: "lookup_audience",
  description: "Look up target audience demographics and preferences",
  parameters: z.object({
    product_type: z.string().describe("Type of product"),
  }),
  execute: async ({ product_type }) => ({
    primary_audience: "Professional developers (25-45)",
    secondary_audience: "CS students and bootcamp grads",
    pain_points: ["context switching", "slow autocomplete", "debugging friction"],
    preferred_tone: "confident but approachable, technical but not jargon-heavy",
  }),
});

// The writer can check a tone/style guide
const checkStyleGuide = tool({
  name: "check_style_guide",
  description: "Check the brand style guide for writing rules",
  parameters: z.object({
    brand: z.string().describe("Brand name"),
  }),
  execute: async ({ brand }) => ({
    brand,
    voice: "Bold, clear, developer-friendly",
    rules: [
      "Lead with the benefit, not the feature",
      "Use active voice",
      "Keep taglines under 8 words",
      "No buzzwords: 'synergy', 'leverage', 'paradigm'",
    ],
    examples: {
      good: "Code that thinks with you",
      bad: "Leveraging AI to synergize your workflow",
    },
  }),
});

// ---------------------------------------------------------------------------
// Specialist agents (each with their own tools)
// ---------------------------------------------------------------------------

const researcher = new Agent({
  name: "researcher",
  instructions:
    "You are a market researcher. Use your tools to gather data about the market " +
    "and target audience, then write a concise research brief (3-4 bullet points).",
  tools: [lookupMarketData, lookupAudience],
});

const writer = new Agent({
  name: "writer",
  instructions:
    "You are a copywriter. Always check the brand style guide first, then write copy " +
    "that follows it. Produce only the copy — a tagline and 2-3 sentence description. No commentary.",
  tools: [checkStyleGuide],
});

// ---------------------------------------------------------------------------
// Coordinator with hooks for visibility
// ---------------------------------------------------------------------------

const hooks: Hooks = {
  onToolStart: ({ name }) => {
    console.log(`\n→ Delegating to "${name}"...`);
  },
  onToolEnd: ({ name, durationMs }) => {
    console.log(`← "${name}" responded (${durationMs}ms)`);
  },
};

const coordinator = new Agent({
  name: "coordinator",
  instructions:
    "You are an editorial coordinator. When asked to create marketing copy:\n" +
    "1. First, use the research tool to get market context and audience insights\n" +
    "2. Then, use the writer tool — include the research findings in your request so the writer can use them\n" +
    "3. Finally, present the copy clearly\n" +
    "Always use both tools in sequence.",
  tools: [
    researcher.asTool({
      name: "research",
      description: "Ask the researcher to gather market data and audience insights. Pass the product description as input.",
    }),
    writer.asTool({
      name: "writer",
      description: "Ask the copywriter to write marketing copy. Include any research context and the full brief as input.",
    }),
  ],
  hooks,
});

// ---------------------------------------------------------------------------
// Run it
// ---------------------------------------------------------------------------

console.log("=== Multi-Agent Editorial Pipeline ===\n");
console.log("Brief: Write a tagline + description for 'FlowCode', an AI-powered code editor\n");

const result = await coordinator.run(
  "Write a tagline and a short description (2-3 sentences) for a new AI-powered code editor called 'FlowCode'.",
);

console.log("\n=== Final Output ===\n");
console.log(result.output);

console.log("\n=== Run Stats ===");
console.log(`Coordinator iterations: ${result.meta.iterations}`);
console.log(`Coordinator tool calls: ${result.meta.toolCalls.length}`);
console.log(`Coordinator tokens: ${result.meta.usage.totalTokens}`);

for (const call of result.meta.toolCalls) {
  const sub = call.output as { iterations: number; toolCalls: number; usage: { totalTokens: number } };
  console.log(`  └ ${call.name}: ${sub.usage.totalTokens} tokens, ${sub.iterations} iteration(s), ${sub.toolCalls} tool call(s)`);
}
