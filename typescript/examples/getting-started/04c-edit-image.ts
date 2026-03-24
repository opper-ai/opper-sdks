// Image editing — send a base64 image and an edit prompt to transform it.
// The platform routes to image_edit() when the schemas indicate image input + edit prompt.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imageBase64 = readFileSync(resolve(__dirname, "media/image.png")).toString("base64");

const opper = new Opper();

const edited = await opper.call("sdk-test-edit-image", {
  input_schema: z.object({
    image: z.string().describe("Base64-encoded image to edit"),
    edit_prompt: z.string().describe("Description of the edits to apply"),
  }),
  output_schema: z.object({
    edited_image: z.string().describe("Base64-encoded edited image in PNG format"),
  }),
  input: {
    image: imageBase64,
    edit_prompt: "Give the cat some sunglasses and a party hat",
  },
});

console.log("Edited image base64 length:", edited.data.edited_image.length);

// Save to file for preview
const outPath = resolve(__dirname, "media/edited-image.png");
writeFileSync(outPath, Buffer.from(edited.data.edited_image, "base64"));
console.log(`Saved to ${outPath} — open it to preview!`);
