// List available models with filtering by type
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── All models ──────────────────────────────────────────────────────────────

const all = await opper.models.list({ limit: 500 });
console.log(`── All models: ${all.length} ──`);

// ── Filter by type ──────────────────────────────────────────────────────────

const types = ["llm", "embedding", "image", "video", "tts", "stt", "rerank", "ocr", "realtime"];

for (const type of types) {
  const models = await opper.models.list({ type, limit: 500 });
  if (models.length === 0) continue;

  console.log(`\n── ${type} models (${models.length}) ──`);
  for (const model of models.slice(0, 5)) {
    console.log(`  ${model.id} (${model.provider})`);
  }
  if (models.length > 5) {
    console.log(`  ... and ${models.length - 5} more`);
  }
}

// ── Filter by provider ──────────────────────────────────────────────────────

console.log("\n── Anthropic LLMs ──");
const anthropic = await opper.models.list({ type: "llm", provider: "anthropic" });
for (const model of anthropic) {
  console.log(`  ${model.id}`);
}

// ── Search ──────────────────────────────────────────────────────────────────

console.log("\n── Search: 'claude' ──");
const search = await opper.models.list({ q: "claude" });
for (const model of search) {
  console.log(`  ${model.id} (${model.provider})`);
}
