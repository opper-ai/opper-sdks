import { Opper } from "opperai";

const opper = new Opper();

// setup
const kb = await opper.knowledge.create({ name: `docs-snippet-${Date.now()}` });
const kbId = kb.id;
await opper.knowledge.add(kbId, { content: "Old content", metadata: { source: "outdated" } });
// /setup

// --- docs ---
// Delete documents matching filters
await opper.knowledge.deleteDocuments(kbId, {
  filters: [{ field: "source", operation: "=", value: "outdated" }],
});
// --- /docs ---

console.log("Documents deleted");
// cleanup
await opper.knowledge.delete(kbId);
