import { Opper } from "opperai";

const opper = new Opper();

// List all models
const all = await opper.models.list();
for (const model of all.slice(0, 5)) {
  console.log(`${model.id} (${model.provider})`);
}

// Filter by type
const llms = await opper.models.list({ type: "llm", provider: "anthropic" });
for (const model of llms) {
  console.log(model.id);
}
