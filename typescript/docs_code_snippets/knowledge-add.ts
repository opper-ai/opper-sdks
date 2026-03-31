import { Opper } from "opperai";

const opper = new Opper();

await opper.knowledge.add("kb-id", {
  content: "TypeScript is a typed superset of JavaScript.",
  metadata: { source: "docs", topic: "typescript" },
});
