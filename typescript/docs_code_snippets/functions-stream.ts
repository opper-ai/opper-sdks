import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

for await (const chunk of opper.stream("my-function", {
  input: { text: "Explain streaming" },
  output_schema: z.object({ summary: z.string() }),
})) {
  if (chunk.type === "content") process.stdout.write(chunk.delta);
  if (chunk.type === "done") console.log();
}
