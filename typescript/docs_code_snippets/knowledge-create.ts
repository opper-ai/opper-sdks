import { Opper } from "opperai";

const opper = new Opper();

const kb = await opper.knowledge.create({ name: `docs-snippet-kb-${Date.now()}` });
console.log(`Created: ${kb.id} (${kb.name})`);

// Cleanup
await opper.knowledge.delete(kb.id);
