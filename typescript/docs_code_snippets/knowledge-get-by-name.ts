import { Opper } from "opperai";

const opper = new Opper();

// setup
const kbName = `docs-snippet-${Date.now()}`;
const created = await opper.knowledge.create({ name: kbName });
// /setup

// --- docs ---
const kb = await opper.knowledge.getByName(kbName);
console.log(`Name: ${kb.name}, Docs: ${kb.count}, Model: ${kb.embedding_model}`);
// --- /docs ---

// cleanup
await opper.knowledge.delete(created.id);
