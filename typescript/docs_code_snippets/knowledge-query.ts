import { Opper } from "opperai";

const opper = new Opper();

// setup
const kb = await opper.knowledge.create({ name: `docs-snippet-${Date.now()}` });
const kbId = kb.id;
await opper.knowledge.add(kbId, { content: "TypeScript is a typed superset of JavaScript." });
await new Promise((r) => setTimeout(r, 2000)); // wait for indexing
// /setup

// --- docs ---
const results = await opper.knowledge.query(kbId, {
  query: "typed language for web",
  top_k: 3,
});
for (const r of results) {
  console.log(`[${r.score.toFixed(3)}] ${r.content.slice(0, 80)}`);
}
// --- /docs ---

// cleanup
await opper.knowledge.delete(kbId);
