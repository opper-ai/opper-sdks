// Image generation via function execution
import { Opper } from "../../src/index.js";

const client = new Opper();

const result = await client.run("sdk-test/describe-scene", {
  input_schema: {
    type: "object",
    properties: { scene: { type: "string" } },
    required: ["scene"],
  },
  output_schema: {
    type: "object",
    properties: {
      description: { type: "string" },
      mood: { type: "string" },
      colors: { type: "array", items: { type: "string" } },
    },
    required: ["description", "mood", "colors"],
  },
  input: { scene: "A sunset over a calm ocean with a single sailboat" },
});

const output = result.output as { description: string; mood: string; colors: string[] };
console.log("Description:", output.description);
console.log("Mood:", output.mood);
console.log("Colors:", output.colors);
