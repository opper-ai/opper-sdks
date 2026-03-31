import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

// --- docs ---
for await (const chunk of opper.stream("docs-snippet-stream", {
  input: { text: "Explain streaming" },
  output_schema: z.object({ summary: z.string() }),
})) {
  if (chunk.type === "content") process.stdout.write(chunk.delta);
  if (chunk.type === "done") console.log();
}
// --- /docs ---

// cleanup
await opper.functions.delete("docs-snippet-stream");
