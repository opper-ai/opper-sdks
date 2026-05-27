// Agent with BOTH tools AND a structured output schema.
//
// Some providers (some routed through gemini/, vertexai/ Gemini 1.x,
// fireworks/, evroc/, etc.) don't accept a JSON-schema response format and
// a non-empty `tools` array in the same request. The Agent SDK detects
// this via a capability lookup and transparently injects a synthetic
// `final_answer` tool whose parameters are the requested output schema.
// The loop intercepts that call and returns the structured output.
//
// Three things make the fallback visible so you can verify it:
//   1. result.output is your typed Zod-inferred object either way.
//   2. result.meta.toolCalls contains a `final_answer` record on the
//      fallback path, in addition to the real tools the agent called.
//   3. The platform trace shows a `final_answer` span tagged
//      {final_answer: true} under the agent root span.
//
// Try changing `model` between a whitelisted one (anthropic/claude-*,
// openai/gpt-*, vertexai/gemini-2+, gcp/gemini-2+) and a non-whitelisted
// one (fireworks/glm-5.1, evroc/moonshotai/Kimi-K2.6) to see both paths.
// You can also force a path with `structuredOutputMode: "tool"` /
// `"native"` if you want to compare without changing the model.

import { z } from "zod";
import { Agent, tool } from "../../src/index.js";

// ── Tiny in-memory product DB the agent can query through tools ─────────────

const PRODUCTS: Record<string, { name: string; price: number; stock: number }> = {
  "prod-001": { name: "Wireless Headphones", price: 79.99, stock: 42 },
  "prod-002": { name: "Mechanical Keyboard", price: 129.99, stock: 15 },
  "prod-003": { name: "USB-C Hub", price: 49.99, stock: 0 },
};

const lookupProduct = tool({
  name: "lookup_product",
  description: "Look up a product by its ID. Returns name, price, and stock.",
  parameters: z.object({
    product_id: z.string().describe("The product ID (e.g. prod-001)"),
  }),
  execute: async ({ product_id }) => {
    const product = PRODUCTS[product_id];
    if (!product) return { error: `Product ${product_id} not found` };
    return product;
  },
});

const checkAvailability = tool({
  name: "check_availability",
  description: "Check whether a product is available in the requested quantity",
  parameters: z.object({
    product_id: z.string().describe("The product ID"),
    quantity: z.number().describe("Requested quantity"),
  }),
  execute: async ({ product_id, quantity }) => {
    const product = PRODUCTS[product_id];
    if (!product) return { available: false, reason: "Product not found" };
    if (product.stock >= quantity) return { available: true, stock: product.stock };
    return { available: false, stock: product.stock, reason: "low stock" };
  },
});

// ── Output schema: nested enough to exercise the fallback's $ref handling ──

const LineItemSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  requested_quantity: z.number(),
  unit_price: z.number(),
  line_total: z.number(),
  available: z.boolean(),
});

const OrderDecisionSchema = z.object({
  can_fulfill_in_full: z.boolean(),
  items: z.array(LineItemSchema),
  subtotal: z.number(),
  notes: z.string().describe("One-sentence summary of the decision."),
});

const agent = new Agent({
  name: "order-checker",
  instructions:
    "Use the available tools to look up each product the customer mentions and " +
    "check whether the requested quantity is available. Then return a structured " +
    "OrderDecision summarising the result.",
  tools: [lookupProduct, checkAvailability],
  outputSchema: OrderDecisionSchema,
  // Capable model (native path). Switch to e.g. "fireworks/glm-5.1" or
  // "evroc/moonshotai/Kimi-K2.6" to see the synthetic-tool fallback at
  // work — same code, same result shape.
  model: "anthropic/claude-haiku-4-5",
  // Or force one path explicitly:
  //   structuredOutputMode: "tool"    // always use final_answer fallback
  //   structuredOutputMode: "native"  // always send JSON-schema + tools
});

const result = await agent.run(
  "Customer wants 5 units of prod-001 and 30 units of prod-002. " +
    "Can we fulfill, and what's the subtotal?",
);

const decision = result.output;
console.log("Can fulfill in full:", decision.can_fulfill_in_full);
console.log("Subtotal:", decision.subtotal);
console.log("Notes:", decision.notes);
console.log("\nLine items:");
for (const item of decision.items) {
  const flag = item.available ? "ok" : "short";
  console.log(
    `  - ${item.product_id} (${item.name}) x${item.requested_quantity} = $${item.line_total.toFixed(2)} [${flag}]`,
  );
}

// Tool-call audit. On the fallback path, the last entry is the synthetic
// `final_answer` call — its `input` and `output` carry the structured
// decision the model committed to.
console.log("\nTool calls made by the agent:");
for (const call of result.meta.toolCalls) {
  const marker = call.name === "final_answer" ? " (final_answer)" : "";
  const body =
    typeof call.input === "string" ? call.input : JSON.stringify(call.input).slice(0, 100);
  console.log(`  - ${call.name}${marker} <- ${body}`);
}

console.log(`\nIterations: ${result.meta.iterations}`);
console.log(`Tokens used: ${result.meta.usage.totalTokens}`);
