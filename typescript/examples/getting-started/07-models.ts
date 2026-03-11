// List available models
import { Opper } from "../../src/index.js";

const client = new Opper();

const response = await client.models.listModels();
const models = response.models ?? [];

console.log(`Available models: ${models.length}`);
for (const model of models.slice(0, 10)) {
  console.log(`  ${model.id} (${model.provider})`);
}

if (models.length > 10) {
  console.log(`  ... and ${models.length - 10} more`);
}
