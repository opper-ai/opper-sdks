import { Opper } from "opperai";

const opper = new Opper();

const trace = await opper.traces.getTrace("trace-id");
console.log(`Name: ${trace.name}, Spans: ${trace.span_count}`);
for (const s of trace.spans) {
  const indent = s.parent_id ? "    " : "  ";
  console.log(`${indent}${s.name} (${s.id.slice(0, 8)}...)`);
}
