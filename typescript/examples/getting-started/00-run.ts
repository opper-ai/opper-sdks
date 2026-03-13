// Basic function execution with run()
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.run("sdk-test-summarize", {
  output: z.object({ summary: z.string() }),
  input_schema: z.object({ text: z.string() }),
  input: {
    text: "TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.",
  },
  model: "aws/ministral-8b",
});

console.log("Output:", result.output.summary); // typed!
console.log("Model used:", result.meta?.models_used);
console.log("Execution time:", result.meta?.execution_ms, "ms");

//full result
console.log("Full result object:", JSON.stringify(result, null, 2));
