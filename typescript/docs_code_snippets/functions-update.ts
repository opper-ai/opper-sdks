import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

// setup
const fnName = `docs-snippet-fn-${Date.now()}`;
await opper.call(fnName, { input: "hello", output_schema: z.object({ reply: z.string() }) });
// /setup

// --- docs ---
const fn = await opper.functions.get(fnName);
console.log(`Name: ${fn.name}, Hit count: ${fn.hit_count}`);
// --- /docs ---

// cleanup
await opper.functions.delete(fnName);
