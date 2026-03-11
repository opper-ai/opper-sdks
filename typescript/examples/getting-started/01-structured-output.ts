// Structured output with typed schemas
import { Opper } from "../../src/index.js";

const client = new Opper();

const result = await client.run("sdk-test/extract-entities", {
  input_schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  output_schema: {
    type: "object",
    properties: {
      people: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" },
          },
          required: ["name"],
        },
      },
      locations: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["people", "locations"],
  },
  input: {
    text: "Marie Curie conducted groundbreaking research on radioactivity in Paris. She was the first woman to win a Nobel Prize.",
  },
});

const output = result.output as { people: { name: string; role?: string }[]; locations: string[] };
console.log("People:", output.people);
console.log("Locations:", output.locations);
