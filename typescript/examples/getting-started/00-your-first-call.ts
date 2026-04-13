// Basic function execution with call()
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("my-first-call", {
  input: "What is TypeScript?",
});

console.log("Full result object:", result);

// You can also specify a model — as a string or with provider-specific options
const result2 = await opper.call("my-first-call", {
  input: "What is TypeScript?",
  model: { name: "anthropic/claude-sonnet-4-6", options: { max_tokens: 100 } },
});

console.log("With model options:", result2.data);
