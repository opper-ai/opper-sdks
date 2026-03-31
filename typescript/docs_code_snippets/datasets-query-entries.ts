import { Opper } from "opperai";

const opper = new Opper();

const results = await opper.datasets.queryEntries("dataset-id", {
  query: "Python programming",
});
for (const entry of results) {
  console.log(`[${entry.score.toFixed(3)}] ${JSON.stringify(entry.input)}`);
}
