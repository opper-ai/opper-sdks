import { Opper } from "opperai";

const opper = new Opper();

// setup
const kb = await opper.knowledge.create({ name: `docs-snippet-${Date.now()}` });
const kbId = kb.id;
// /setup

// --- docs ---
await opper.knowledge.add(kbId, {
  content: "TypeScript is a typed superset of JavaScript.",
  metadata: { source: "docs", topic: "typescript" },
});
// --- /docs ---

console.log("Document added");
// cleanup
await opper.knowledge.delete(kbId);
