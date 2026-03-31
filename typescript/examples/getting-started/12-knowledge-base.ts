// Knowledge Base — store, index, and query documents using semantic search.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const opper = new Opper();
const KB_NAME = "sdk-example-kb";

// ── Create a knowledge base ─────────────────────────────────────────────────

const kb = await opper.knowledge.create({ name: KB_NAME });
console.log("Created KB:", kb.id, kb.name);

// ── Add documents ───────────────────────────────────────────────────────────

await opper.knowledge.add(kb.id, {
  content: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
  metadata: { source: "docs", topic: "typescript" },
});

await opper.knowledge.add(kb.id, {
  content: "Python is a high-level, interpreted programming language known for its readability.",
  metadata: { source: "docs", topic: "python" },
});

await opper.knowledge.add(kb.id, {
  content: "Rust is a systems programming language focused on safety, speed, and concurrency.",
  metadata: { source: "docs", topic: "rust" },
});

console.log("\nAdded 3 documents");

// ── Query the knowledge base ────────────────────────────────────────────────

const results = await opper.knowledge.query(kb.id, {
  query: "typed language for web development",
  top_k: 2,
});

console.log("\n── Query: 'typed language for web development' ──");
for (const r of results) {
  console.log(`  [${r.score.toFixed(3)}] ${r.content.slice(0, 80)}...`);
}

// ── Query with filters ──────────────────────────────────────────────────────

const filtered = await opper.knowledge.query(kb.id, {
  query: "programming language",
  filters: [{ field: "topic", operation: "=", value: "rust" }],
});

console.log("\n── Filtered query (topic=rust) ──");
for (const r of filtered) {
  console.log(`  [${r.score.toFixed(3)}] ${r.content.slice(0, 80)}...`);
}

// ── Upload a file ───────────────────────────────────────────────────────────

const pdfBuffer = readFileSync(resolve(__dirname, "media/sample.pdf"));
const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

const uploaded = await opper.knowledge.uploadFile(kb.id, pdfBlob, {
  filename: "sample.pdf",
  metadata: { source: "file", type: "pdf" },
});
console.log("\nUploaded file:", uploaded.original_filename, "→ document", uploaded.document_id);

// ── List files ──────────────────────────────────────────────────────────────

const files = await opper.knowledge.listFiles(kb.id);
console.log("\nFiles in KB:");
for (const f of files.data) {
  console.log(`  ${f.original_filename} (${f.size} bytes, status: ${f.status})`);
}

// ── Get KB info ─────────────────────────────────────────────────────────────

const info = await opper.knowledge.getByName(KB_NAME);
console.log("\nKB info:", { name: info.name, count: info.count, model: info.embedding_model });

// ── Cleanup ─────────────────────────────────────────────────────────────────

await opper.knowledge.delete(kb.id);
console.log("\nDeleted KB:", kb.id);
