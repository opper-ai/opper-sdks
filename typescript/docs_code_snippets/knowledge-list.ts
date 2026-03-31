import { Opper } from "opperai";

const opper = new Opper();

const knowledgeBases = await opper.knowledge.list();
for (const kb of knowledgeBases) {
  console.log(`${kb.name} (id: ${kb.id}, docs: ${kb.count})`);
}
