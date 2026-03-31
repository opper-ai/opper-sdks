import { Opper } from "opperai";

const opper = new Opper();

// setup
const created = await opper.spans.create({ name: "docs-snippet-span" });
const spanId = created.id;
// /setup

// --- docs ---
await opper.spans.update(spanId, {
  output: "Pipeline completed successfully",
  end_time: new Date().toISOString(),
  meta: { total_calls: 3 },
});
// --- /docs ---

console.log("Span updated");
// cleanup
await opper.spans.deleteSpan(spanId);
