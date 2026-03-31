import { Opper } from "opperai";

const opper = new Opper();

const kb = await opper.knowledge.create({ name: "my-knowledge-base" });
console.log(`Created: ${kb.id} (${kb.name})`);
