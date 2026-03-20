// Image generation via function execution
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("sdk-test-describe-scene", {
  output: z.object({
    description: z.string(),
    mood: z.string(),
    colors: z.array(z.string()),
  }),
  input: { scene: "A sunset over a calm ocean with a single sailboat" },
});

console.log("Description:", result.data.description); // typed!
console.log("Mood:", result.data.mood); // typed!
console.log("Colors:", result.data.colors); // typed!
