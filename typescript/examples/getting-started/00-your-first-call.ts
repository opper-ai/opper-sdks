// Basic function execution with run()
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("my-first-call", {
  input: "What is TypeScript?",
});

//full result
console.log("Full result object:", result);


