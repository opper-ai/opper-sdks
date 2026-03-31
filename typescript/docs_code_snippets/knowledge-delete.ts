import { Opper } from "opperai";

const opper = new Opper();

// setup
const kb = await opper.knowledge.create({ name: `docs-snippet-${Date.now()}` });
const kbId = kb.id;
// /setup

// --- docs ---
await opper.knowledge.delete(kbId);
// --- /docs ---

console.log("Knowledge base deleted");
