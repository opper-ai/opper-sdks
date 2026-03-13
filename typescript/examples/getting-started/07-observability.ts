// Observability: automatic tracing with traced()
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── Automatic tracing ────────────────────────────────────────────────────────
// traced() wraps a block of code in a trace span. All run() and stream() calls
// inside automatically get parent_span_id set — no manual wiring needed.

const result = await opper.traced("summarize-flow", async () => {
  const summary = await opper.run("sdk-test-summarize", {
    output: z.object({ summary: z.string() }),
    input_schema: z.object({ text: z.string() }),
    input: { text: "Observability is key to understanding system behavior in production." },
  });

  console.log("Summary:", summary.output.summary);
  return summary;
});

// ── Nested traces ────────────────────────────────────────────────────────────
// Nesting works naturally — inner traced() calls create child spans.

await opper.traced("multi-step-pipeline", async () => {
  const extracted = await opper.run("sdk-test-extract", {
    output: z.object({ keywords: z.array(z.string()) }),
    input_schema: z.object({ text: z.string() }),
    input: { text: "What is the story of Arthur?" },
  });

  console.log("Keywords:", extracted.output.keywords);

  await opper.traced("enrich", async () => {
    const enriched = await opper.run("sdk-test-summarize", {
      output: z.object({ summary: z.string() }),
      input_schema: z.object({ keywords: z.array(z.string()) }),
      input: { keywords: extracted.output.keywords },
    });

    console.log("Enriched:", enriched.output.summary);
  });
});

// ── Span handle for metadata ─────────────────────────────────────────────────
// The callback receives a span handle if you need the IDs or want to add metadata.

await opper.traced(
  { name: "with-metadata", meta: { userId: "u-123" }, tags: { env: "example" } },
  async (span) => {
    console.log("Trace:", span.traceId, "Span:", span.id);

    await opper.run("sdk-test-summarize", {
      output: z.object({ summary: z.string() }),
      input_schema: z.object({ text: z.string() }),
      input: { text: "Span handle gives access to trace and span IDs." },
    });
  },
);

// ── Generations ──────────────────────────────────────────────────────────────
const generations = await opper.generations.listGenerations({ page: 1, page_size: 3 });
console.log(`\nRecent generations: ${generations.meta.total} total`);
for (const gen of generations.data) {
  console.log(`  - ${gen.id}`);
}
