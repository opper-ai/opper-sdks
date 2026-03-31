import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("embed-text", {
  instructions: "Generate an embedding vector for the input text",
  input: { text: "The benefits of using an AI gateway" },
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ embedding: z.array(z.number()) }),
  model: "openai/text-embedding-3-small",
});

console.log(`Dimensions: ${result.data.embedding.length}`);
console.log(`First 5: ${result.data.embedding.slice(0, 5)}`);
