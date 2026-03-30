// Image description (vision) — send a base64 image and get a structured description.
// The platform routes to llm() with multimodal content when the input includes an image.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imageBase64 = readFileSync(resolve(__dirname, "media/image.png")).toString("base64");

const opper = new Opper();

const result = await opper.call("sdk-test-describe-image", {
  input_schema: z.object({
    image: z.string().describe("Base64-encoded image to describe"),
  }),
  output_schema: z.object({
    description: z.string().describe("Detailed description of the image"),
  }),
  input: {
    image: imageBase64,
    // You can also pass a URL instead of base64:
    // image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg",
  },
});

console.log("Description:", result.data.description);
