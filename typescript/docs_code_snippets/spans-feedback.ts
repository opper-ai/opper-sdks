import { Opper } from "opperai";

const opper = new Opper();

// setup
const created = await opper.spans.create({ name: "docs-snippet-span" });
const spanId = created.id;
// /setup

// --- docs ---
await opper.spans.feedback(spanId, { score: 1, comment: "Great response" });
// --- /docs ---

console.log("Feedback submitted");
// cleanup
await opper.spans.deleteSpan(spanId);
