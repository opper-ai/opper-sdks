import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

// setup
const fnName = `docs-snippet-fn-${Date.now()}`;
await opper.call(fnName, { input: "hello", output_schema: z.object({ reply: z.string() }) });
// /setup

// --- docs ---
await opper.functions.delete(fnName);
// --- /docs ---

console.log("Function deleted");
