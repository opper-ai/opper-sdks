// Image generation via the image_gen builtin
// The platform routes to image_gen() when the schemas indicate image output.
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("sdk-test-generate-image", {
  input_schema: z.object({
    description: z.string().describe("Text description of the image to generate"),
  }),
  output_schema: z.object({
    image: z.string().describe("Base64-encoded image data"),
    mime_type: z.string().describe("MIME type of the generated image"),
  }),
  input: {
    description: "A sunset over a calm ocean with two sailboats",
  },
  // model: "pruna/p-image", specify any model here
});


console.log("MIME type:", result.data.mime_type);
console.log("Image base64 length:", result.data.image.length);
console.log("Meta:", result.meta);

// Save to file for preview
const ext = result.data.mime_type.split("/")[1] || "png";
const outPath = `generated-image.${ext}`;
writeFileSync(outPath, Buffer.from(result.data.image, "base64"));
console.log(`Saved to ${outPath} — open it to preview!`);
