import { Opper } from "opperai";

const opper = new Opper();

// setup
const created = await opper.spans.create({ name: "docs-snippet-span" });
const spanId = created.id;
// /setup

// --- docs ---
await opper.spans.deleteSpan(spanId);
// --- /docs ---

console.log("Span deleted");
