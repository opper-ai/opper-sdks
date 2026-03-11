// Observability: spans and generations
import { Opper } from "../../src/index.js";

const client = new Opper();

// Create a span to trace an operation
const span = await client.spans.create({
  name: "sdk-test-span",
  input: "Testing span creation from SDK",
});
console.log("Created span:", span.id, "trace:", span.trace_id);

// Run a function linked to this span
const result = await client.run("sdk-test/summarize", {
  input_schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  output_schema: {
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
  },
  input: { text: "Observability is key to understanding system behavior in production." },
  parent_span_id: span.id,
});

console.log("Function output:", JSON.stringify(result.output));

// Update the span with the result
await client.spans.update(span.id, {
  output: JSON.stringify(result.output),
  end_time: new Date().toISOString(),
});
console.log("Span updated with output");

// List recent generations
const generations = await client.generations.listGenerations({ page: 1, page_size: 3 });
console.log(`\nRecent generations: ${generations.meta.total} total`);
for (const gen of generations.data) {
  console.log(`  - ${(gen as Record<string, unknown>).id}`);
}
