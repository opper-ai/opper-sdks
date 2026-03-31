import { Opper } from "opperai";

const opper = new Opper();

// setup
const created = await opper.spans.create({ name: "docs-snippet-trace" });
const traceId = created.trace_id;
// /setup

// --- docs ---
const trace = await opper.traces.getTrace(traceId);
console.log(`Name: ${trace.name}, Spans: ${trace.span_count}`);
for (const s of trace.spans) {
  const indent = s.parent_id ? "    " : "  ";
  console.log(`${indent}${s.name} (${s.id.slice(0, 8)}...)`);
}
// --- /docs ---

// cleanup
await opper.traces.deleteTrace(traceId);
