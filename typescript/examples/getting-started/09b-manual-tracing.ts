// Manual tracing: create spans directly and wire parent_span_id by hand.
// Use this when you need full control over span lifecycle, or when integrating
// with external tracing systems. For automatic tracing, see 09-observability.ts.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── Create a root span ──────────────────────────────────────────────────────
// A root span starts a new trace. The server returns both a span ID and trace ID.

const rootSpan = await opper.spans.create({
  name: "my-pipeline",
  start_time: new Date().toISOString(),
  input: "Starting the pipeline",
  meta: { userId: "u-123", environment: "example" },
  tags: { team: "sdk" },
});

console.log("── Root span created ──");
console.log("Span ID:", rootSpan.id);
console.log("Trace ID:", rootSpan.trace_id);

// ── Call a function under this span ─────────────────────────────────────────
// Pass parent_span_id to attach the function call to the trace.

const result = await opper.call("sdk-test-summarize", {
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ summary: z.string() }),
  input: { text: "Manual tracing lets you control exactly how spans are organized." },
  parent_span_id: rootSpan.id,
});

console.log("\n── Function call (attached to root span) ──");
console.log("Summary:", result.data.summary);

// ── Create a child span ─────────────────────────────────────────────────────
// Use trace_id and parent_id to nest spans within the same trace.

const childSpan = await opper.spans.create({
  name: "enrichment-step",
  trace_id: rootSpan.trace_id,
  parent_id: rootSpan.id,
  start_time: new Date().toISOString(),
  input: "Enriching the summary",
});

console.log("\n── Child span created ──");
console.log("Child span ID:", childSpan.id);
console.log("Parent:", childSpan.parent_id);

// Call another function under the child span
const enriched = await opper.call("sdk-test-extract", {
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ keywords: z.array(z.string()) }),
  input: { text: result.data.summary },
  parent_span_id: childSpan.id,
});

console.log("Keywords:", enriched.data.keywords);

// ── Update spans with output and end time ───────────────────────────────────
// Close spans when done — record output, errors, or additional metadata.

await opper.spans.update(childSpan.id, {
  output: JSON.stringify({ keywords: enriched.data.keywords }),
  end_time: new Date().toISOString(),
});

await opper.spans.update(rootSpan.id, {
  output: JSON.stringify({ summary: result.data.summary }),
  end_time: new Date().toISOString(),
  meta: { total_calls: 2 },
});

console.log("\n── Spans closed ──");
console.log(`View trace: trace_id=${rootSpan.trace_id}`);
