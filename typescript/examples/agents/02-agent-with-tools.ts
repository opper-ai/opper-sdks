// Agent with tools — the loop executes tool calls automatically until done
import { z } from "zod";
import { Agent, tool } from "../../src/index.js";

// Simulated database of products
const PRODUCTS: Record<string, { name: string; price: number; stock: number }> = {
  "prod-001": { name: "Wireless Headphones", price: 79.99, stock: 42 },
  "prod-002": { name: "Mechanical Keyboard", price: 129.99, stock: 15 },
  "prod-003": { name: "USB-C Hub", price: 49.99, stock: 0 },
};

const lookupProduct = tool({
  name: "lookup_product",
  description: "Look up a product by its ID to get name, price, and stock level",
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
  description: "Check if a product is available for purchase",
  parameters: z.object({
    product_id: z.string().describe("The product ID"),
    quantity: z.number().describe("Requested quantity"),
  }),
  execute: async ({ product_id, quantity }) => {
    const product = PRODUCTS[product_id];
    if (!product) return { available: false, reason: "Product not found" };
    if (product.stock >= quantity) {
      return { available: true, stock: product.stock };
    }
    return { available: false, reason: `Only ${product.stock} units in stock`, stock: product.stock };
  },
});

const agent = new Agent({
  name: "shop-assistant",
  instructions:
    "You are a helpful shopping assistant. Use the available tools to look up products and check availability. Be concise.",
  tools: [lookupProduct, checkAvailability],
});

const result = await agent.run(
  "Can I order 10 units of prod-002? Also, what's the price of prod-001?",
);

console.log("Answer:", result.output);
console.log("\nTool calls made:");
for (const call of result.meta.toolCalls) {
  console.log(` - ${call.name}(${JSON.stringify(call.input)}) → ${JSON.stringify(call.output)} (${call.durationMs}ms)`);
}
console.log("\nIterations:", result.meta.iterations);
console.log("Tokens used:", result.meta.usage.totalTokens);
