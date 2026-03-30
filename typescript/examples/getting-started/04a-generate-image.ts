// Image generation via the image_gen builtin.
// The platform routes to image_gen() when the schemas indicate image output.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const opper = new Opper();

// ── Option 1: Schema-driven call() ──────────────────────────────────────────
// Just by describing the input/output schemas, the platform routes to image_gen.

const raw = await opper.call("sdk-test-generate-image-raw", {
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
  // model: "pruna/p-image",
});

console.log("── Schema-driven call() ──");
console.log("MIME type:", raw.data.mime_type);
console.log("Image base64 length:", raw.data.image.length);

const ext = raw.data.mime_type.split("/")[1] || "png";
const rawPath = resolve(__dirname, `media/generated-image-raw.${ext}`);
writeFileSync(rawPath, Buffer.from(raw.data.image, "base64"));
console.log(`Saved to ${rawPath}`);

// ── Option 2: Convenience method ────────────────────────────────────────────

const easy = await opper.generateImage("sdk-test-generate-image", {
  prompt: "A sunset over a calm ocean with two sailboats",
  // model: "pruna/p-image",   // specify any model here
  // size: "1024x1024",        // request a specific size
  // mime_type: "image/webp",  // request a specific format
});

console.log("\n── Convenience method ──");
console.log("MIME type:", easy.data.mime_type);
console.log("Image base64 length:", easy.data.image.length);
console.log("Meta:", easy.meta);

// Save to file — extension auto-appended from mime_type
const easyPath = easy.save(resolve(__dirname, "media/generated-image"));
console.log(`Saved to ${easyPath}`);
