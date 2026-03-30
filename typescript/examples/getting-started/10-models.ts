// List available models with filtering by type
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── All models ──────────────────────────────────────────────────────────────

const all = await opper.models.listModels({ limit: 500 });
console.log(`── All models: ${all.models.length} ──`);

// ── Filter by type ──────────────────────────────────────────────────────────

const types = ["llm", "embedding", "image", "video", "tts", "stt", "rerank", "ocr", "realtime"];

for (const type of types) {
  const response = await opper.models.listModels({ type, limit: 500 });
  const models = response.models ?? [];
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
const anthropic = await opper.models.listModels({ type: "llm", provider: "anthropic" });
for (const model of anthropic.models) {
  console.log(`  ${model.id}`);
}

// ── Search ──────────────────────────────────────────────────────────────────

console.log("\n── Search: 'claude' ──");
const search = await opper.models.listModels({ q: "claude" });
for (const model of search.models) {
  console.log(`  ${model.id} (${model.provider})`);
}
