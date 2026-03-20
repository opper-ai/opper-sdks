// Observability: automatic tracing with traced()
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── Automatic tracing ────────────────────────────────────────────────────────
// traced() wraps a block of code in a trace span. All run() and stream() calls
// inside automatically get parent_span_id set — no manual wiring needed.

const result = await opper.traced("summarize-flow", async () => {
  const summary = await opper.call("sdk-test-summarize", {
    output: z.object({ summary: z.string() }),
    input: { text: "Observability is key to understanding system behavior in production." },
  });

  console.log("Summary:", summary.data.summary);
  return summary;
});

// ── Nested traces ────────────────────────────────────────────────────────────
// Nesting works naturally — inner traced() calls create child spans.

await opper.traced("multi-step-pipeline", async () => {
  const extracted = await opper.call("sdk-test-extract", {
    output: z.object({ keywords: z.array(z.string()) }),
    input: { text: "What is the story of Arthur?" },
  });

  console.log("Keywords:", extracted.data.keywords);

  await opper.traced("enrich", async () => {
    const enriched = await opper.call("sdk-test-summarize", {
      output: z.object({ summary: z.string() }),
      input: { keywords: extracted.data.keywords },
    });

    console.log("Enriched:", enriched.data.summary);
  });
});

// ── Span handle for metadata ─────────────────────────────────────────────────
// The callback receives a span handle if you need the IDs or want to add metadata.

await opper.traced(
  { name: "with-metadata", meta: { userId: "u-123" }, tags: { env: "example" } },
  async (span) => {
    console.log("Trace:", span.traceId, "Span:", span.id);

    await opper.call("sdk-test-summarize", {
      output: z.object({ summary: z.string() }),
      input_schema: z.object({ text: z.string() }),
      input: { text: "Span handle gives access to trace and span IDs." },
    });
  },
);

// ── Session tracing ─────────────────────────────────────────────────────────
// A single traced() call groups multiple interactions under one trace.
// Great for chat sessions, multi-turn conversations, or iterative workflows.

import * as readline from "node:readline/promises";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

await opper.traced("chat-session", async (span) => {
  console.log(`\nChat session started (trace: ${span.traceId})`);
  console.log('Type a message, or "quit" to end.\n');

  while (true) {
    const userInput = await rl.question("You: ");
    if (userInput.toLowerCase() === "quit") break;

    const reply = await opper.call("sdk-test-summarize", {
      output: z.object({ summary: z.string() }),
      input: { text: userInput },
    });

    console.log("Assistant:", reply.data.summary, "\n");
  }
});

rl.close();
console.log("Session ended — all calls are grouped under the same trace.");

// ── Generations ──────────────────────────────────────────────────────────────
const generations = await opper.generations.listGenerations({ page: 1, page_size: 3 });
console.log(`\nRecent generations: ${generations.meta.total} total`);
for (const gen of generations.data) {
  console.log(`  - ${gen.id}`);
}
