// Image generation via function execution
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.run("sdk-test-describe-scene", {
  output: z.object({
    description: z.string(),
    mood: z.string(),
    colors: z.array(z.string()),
  }),
  input_schema: z.object({ scene: z.string() }),
  input: { scene: "A sunset over a calm ocean with a single sailboat" },
});

console.log("Description:", result.output.description); // typed!
console.log("Mood:", result.output.mood); // typed!
console.log("Colors:", result.output.colors); // typed!
