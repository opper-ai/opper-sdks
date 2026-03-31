import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("embed-text", {
  input: { text: "The quick brown fox jumps over the lazy dog" },
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ embedding: z.array(z.number()) }),
  model: "openai/text-embedding-3-small",
});

console.log(`Dimensions: ${result.data.embedding.length}`);
