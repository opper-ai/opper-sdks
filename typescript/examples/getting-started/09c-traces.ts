// Traces API: list, get, and inspect traces with their spans.
// Traces are created automatically when you use traced() or manual spans.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── Create a trace by running some calls under traced() ─────────────────────

let traceId: string | undefined;

await opper.traced("sdk-test-trace-demo", async (span) => {
  traceId = span.traceId;

  await opper.call("sdk-test-summarize", {
    output_schema: z.object({ summary: z.string() }),
    input: { text: "Traces group related spans together for observability." },
  });

  await opper.call("sdk-test-extract", {
    output_schema: z.object({ keywords: z.array(z.string()) }),
    input: { text: "Each function call becomes a child span in the trace." },
  });
});

console.log("── Trace created via traced() ──\n");

// ── List recent traces ──────────────────────────────────────────────────────

const traces = await opper.traces.listTraces({ limit: 5 });
console.log(`Recent traces (${traces.data.length}):`);
for (const t of traces.data) {
  console.log(`  ${t.id} — ${t.name ?? "(unnamed)"} (${t.span_count} spans, ${t.duration_ms ?? "?"}ms)`);
}

// ── Get the trace we just created ───────────────────────────────────────────

if (traceId) {
  try {
    const trace = await opper.traces.getTrace(traceId);

    console.log(`\n── Trace detail: ${trace.id} ──`);
    console.log(`Name:   ${trace.name ?? "(unnamed)"}`);
    console.log(`Spans:  ${trace.span_count}`);
    console.log(`Status: ${trace.status ?? "unknown"}`);

    for (const span of trace.spans) {
      const indent = span.parent_id ? "    " : "  ";
      console.log(`${indent}↳ ${span.name} (${span.id.slice(0, 8)}…)${span.error ? " ERROR: " + span.error : ""}`);
    }
  } catch (err) {
    console.log(`\n── getTrace skipped (server returned error) ──`);
  }
}

// ── Get and inspect a specific span ─────────────────────────────────────────

const rootSpan = await opper.spans.create({
  name: "sdk-test-span-inspection",
  start_time: new Date().toISOString(),
  input: "Testing span get",
  meta: { source: "example" },
});

await opper.spans.update(rootSpan.id, {
  output: "Done",
  end_time: new Date().toISOString(),
});

const fetched = await opper.spans.getSpan(rootSpan.id);
console.log(`\n── Span detail ──`);
console.log(`ID:       ${fetched.id}`);
console.log(`Name:     ${fetched.name}`);
console.log(`Trace:    ${fetched.trace_id}`);

// ── Clean up: delete the test span ──────────────────────────────────────────

await opper.spans.deleteSpan(rootSpan.id);
console.log(`\nDeleted test span ${rootSpan.id.slice(0, 8)}…`);
