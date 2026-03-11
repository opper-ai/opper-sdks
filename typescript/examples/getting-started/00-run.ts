// Basic function execution with run()
import { Opper } from "../../src/index.js";

const client = new Opper();

const result = await client.run("sdk-test/summarize", {
  input_schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  output_schema: {
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
  },
  input: {
    text: "TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.",
  },
});

console.log("Output:", JSON.stringify(result.output));
console.log("Model used:", result.meta?.models_used);
console.log("Execution time:", result.meta?.execution_ms, "ms");
