import { Opper } from "opperai";

const opper = new Opper();

// setup
const created = await opper.spans.create({
  name: "docs-snippet-span",
  input: "test input",
  output: "test output",
});
const spanId = created.id;
// /setup

// --- docs ---
await opper.spans.saveToDataset(spanId);
// --- /docs ---

console.log("Saved to dataset");
// cleanup
await opper.spans.deleteSpan(spanId);
