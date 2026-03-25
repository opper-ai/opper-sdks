// Video generation via the video_gen builtin.
// The platform routes to video_gen() when the schemas indicate video output.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const opper = new Opper();

// ── Option 1: Convenience method ────────────────────────────────────────────

console.log("Generating video (convenience) — this can take up to a couple of minutes...");
const easy = await opper.generateVideo("sdk-test-generate-video", {
  prompt: "A calm ocean wave rolling onto a sandy beach at sunset, cinematic",
});

console.log("── Convenience method ──");
console.log("MIME type:", easy.data.mime_type);
console.log("Video base64 length:", easy.data.video.length);

const easyPath = easy.save(resolve(__dirname, "media/generated-video"));
console.log(`Saved to ${easyPath}`);

// Advanced options (uncomment to try):
// const advanced = await opper.generateVideo("sdk-test-generate-video-advanced", {
//   prompt: "A cat wearing sunglasses walking down a city street",
//   model: "openai/sora-2",
//   aspect_ratio: "16:9",
//   frame_num: 120,
//   fps: 24,
// });

// ── Option 2: Raw call() with explicit schemas ─────────────────────────────

console.log("\nGenerating video (raw call) — this can take up to a couple of minutes...");
const raw = await opper.call("sdk-test-generate-video-raw", {
  input_schema: z.object({
    prompt: z.string().describe("Text description of the video to generate"),
  }),
  output_schema: z.object({
    video: z.string().describe("Base64-encoded video data"),
    mime_type: z.string().describe("MIME type of the generated video"),
  }),
  input: {
    prompt: "A calm ocean wave rolling onto a sandy beach at sunset, cinematic",
  },
});

console.log("\n── Raw call() ──");
console.log("MIME type:", raw.data.mime_type);
console.log("Video base64 length:", raw.data.video.length);

const ext = raw.data.mime_type.split("/")[1] || "mp4";
const rawPath = resolve(__dirname, `media/generated-video-raw.${ext}`);
writeFileSync(rawPath, Buffer.from(raw.data.video, "base64"));
console.log(`Saved to ${rawPath}`);
