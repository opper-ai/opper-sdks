// Image editing — pass a reference image to generateImage() to transform it.
// The platform routes to image_gen() with the reference image included.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const opper = new Opper();

// ── Option 1: Schema-driven call() ──────────────────────────────────────────
// Schemas alone tell the platform this is an image edit — include a reference_image field.

const imageBase64 = readFileSync(resolve(__dirname, "media/image.png")).toString("base64");

const raw = await opper.call("sdk-test-edit-image-raw", {
  input_schema: z.object({
    description: z.string().describe("Text description of the image to generate"),
    reference_image: z.string().describe("Base64-encoded reference image"),
  }),
  output_schema: z.object({
    image: z.string().describe("Base64-encoded image data"),
    mime_type: z.string().describe("MIME type of the generated image"),
  }),
  input: {
    description: "Give the cat some sunglasses and a party hat",
    reference_image: imageBase64,
  },
});

console.log("── Schema-driven call() ──");
console.log("MIME type:", raw.data.mime_type);
console.log("Image base64 length:", raw.data.image.length);

const ext = raw.data.mime_type.split("/")[1] || "png";
const rawPath = resolve(__dirname, `media/edited-image-raw.${ext}`);
writeFileSync(rawPath, Buffer.from(raw.data.image, "base64"));
console.log(`Saved to ${rawPath}`);

// ── Option 2: Convenience method ────────────────────────────────────────────
// Accepts a file path directly — the SDK reads and base64-encodes it for you.

const easy = await opper.generateImage("sdk-test-edit-image", {
  prompt: "Give the cat some sunglasses and a party hat",
  reference_image: { path: resolve(__dirname, "media/image.png") },
});

console.log("\n── Convenience method ──");
console.log("MIME type:", easy.data.mime_type);
console.log("Image base64 length:", easy.data.image.length);

const easyPath = easy.save(resolve(__dirname, "media/edited-image"));
console.log(`Saved to ${easyPath}`);
