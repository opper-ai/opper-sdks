// Using schemas — recommended approach
// Define your schema once with Zod, get type inference and JSON Schema for the API.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("sdk-test-extract-entities", {
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({
    people: z.array(z.object({ name: z.string(), role: z.string().optional() })),
    locations: z.array(z.string()),
  }),
  input: {
    text: "Marie Curie conducted groundbreaking research on radioactivity in Paris. She was the first woman to win a Nobel Prize. Her husband was Pierre Curie.",
  },
  model: "anthropic/claude-sonnet-4.6",
});
console.log("Full result object:", JSON.stringify(result, null, 2));
console.log("People:", result.data.people); // typed!
console.log("Locations:", result.data.locations); // typed!

