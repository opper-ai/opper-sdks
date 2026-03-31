import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const fnName = `docs-snippet-create-${Date.now()}`;

// --- docs ---
// Functions are auto-created on first call
const result = await opper.call(fnName, {
  input: { text: "Hello world" },
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ summary: z.string() }),
});
console.log(result.data);
// --- /docs ---

// cleanup
await opper.functions.delete(fnName);
