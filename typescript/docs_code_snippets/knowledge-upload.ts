import { readFileSync } from "node:fs";
import { Opper } from "opperai";

const opper = new Opper();

const pdfBuffer = readFileSync("document.pdf");
const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

const uploaded = await opper.knowledge.uploadFile("kb-id", pdfBlob, {
  filename: "document.pdf",
  metadata: { source: "upload" },
});
console.log(`Uploaded: ${uploaded.original_filename} -> ${uploaded.document_id}`);
