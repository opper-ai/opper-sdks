import { Opper } from "opperai";

const opper = new Opper();

// setup
const kb = await opper.knowledge.create({ name: `docs-snippet-${Date.now()}` });
const kbId = kb.id;
await opper.knowledge.uploadFile(kbId, new Blob(["test content"], { type: "text/plain" }), {
  filename: "test.txt",
});
// /setup

// --- docs ---
const files = await opper.knowledge.listFiles(kbId);
for (const f of files.data) {
  console.log(`${f.original_filename} (${f.size} bytes, status: ${f.status})`);
}
// --- /docs ---

// cleanup
await opper.knowledge.delete(kbId);
