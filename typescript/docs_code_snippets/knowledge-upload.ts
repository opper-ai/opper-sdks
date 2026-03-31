import { Opper } from "opperai";

const opper = new Opper();

// setup
const kb = await opper.knowledge.create({ name: `docs-snippet-${Date.now()}` });
const kbId = kb.id;
const pdfBlob = new Blob(["Hello world PDF content"], { type: "application/pdf" });
// /setup

// --- docs ---
const uploaded = await opper.knowledge.uploadFile(kbId, pdfBlob, {
  filename: "document.pdf",
  metadata: { source: "upload" },
});
console.log(`Uploaded: ${uploaded.original_filename} -> ${uploaded.document_id}`);
// --- /docs ---

// cleanup
await opper.knowledge.delete(kbId);
