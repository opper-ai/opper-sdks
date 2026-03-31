import { Opper } from "opperai";

const opper = new Opper();

const entries = await opper.datasets.listEntries("dataset-id");
for (const entry of entries) {
  console.log(`Input: ${JSON.stringify(entry.input)}, Output: ${JSON.stringify(entry.output)}`);
}
