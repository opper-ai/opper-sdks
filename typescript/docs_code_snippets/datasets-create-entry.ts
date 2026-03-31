import { Opper } from "opperai";

const opper = new Opper();

await opper.datasets.createEntry("dataset-id", {
  input: { text: "What is Python?" },
  output: { answer: "A programming language." },
});
