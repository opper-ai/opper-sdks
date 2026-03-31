import { Opper } from "opperai";

const opper = new Opper();

const kb = await opper.knowledge.getByName("my-knowledge-base");
console.log(`Name: ${kb.name}, Docs: ${kb.count}, Model: ${kb.embedding_model}`);
