import { Opper } from "opperai";

const opper = new Opper();

// setup
const created = await opper.spans.create({ name: "docs-snippet-span" });
const spanId = created.id;
// /setup

// --- docs ---
const span = await opper.spans.getSpan(spanId);
console.log(`Name: ${span.name}, Trace: ${span.trace_id}`);
// --- /docs ---

// cleanup
await opper.spans.deleteSpan(spanId);
