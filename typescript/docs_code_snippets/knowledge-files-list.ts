import { Opper } from "opperai";

const opper = new Opper();

const files = await opper.knowledge.listFiles("kb-id");
for (const f of files.data) {
  console.log(`${f.original_filename} (${f.size} bytes, status: ${f.status})`);
}
