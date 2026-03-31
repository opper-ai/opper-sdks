import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

// --- docs ---
const result = await opper.call("docs-snippet-call", {
  input: { text: "Summarize this" },
  output_schema: z.object({ summary: z.string() }),
});
console.log(result.data);
// --- /docs ---

// cleanup
await opper.functions.delete("docs-snippet-call");
