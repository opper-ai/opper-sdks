import { Opper } from "opperai";

const opper = new Opper();

const response = await opper.knowledge.list();
for (const kb of response.data) {
  console.log(`${kb.name} (id: ${kb.id}, docs: ${kb.count})`);
}
