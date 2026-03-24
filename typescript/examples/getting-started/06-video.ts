// Video generation via the video_gen builtin
// The platform routes to video_gen() when the schemas indicate video output.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const opper = new Opper();

console.log("Generating video — this can take up to a couple of minutes...");
const result = await opper.call("sdk-test-generate-video", {
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

console.log("MIME type:", result.data.mime_type);
console.log("Video base64 length:", result.data.video.length);

// Save to file for preview
const ext = result.data.mime_type.split("/")[1] || "mp4";
const outPath = resolve(__dirname, `media/generated-video.${ext}`);
writeFileSync(outPath, Buffer.from(result.data.video, "base64"));
console.log(`Saved to ${outPath} — open it to preview!`);

// ── Advanced: full control over video generation ────────────────────────────
// Uncomment below to use all available options.
// Available models: "pruna/vace", "openai/sora-2", "xai/grok-imagine-video"
//
// const advanced = await opper.call("sdk-test-generate-video-advanced", {
//   input_schema: z.object({
//     prompt: z.string().describe("Text description of the video to generate"),
//     source_image: z.string().optional().describe("Base64 image to use as first frame"),
//     source_video: z.string().optional().describe("Base64 video to use as reference"),
//     ref_images: z.array(z.string()).optional().describe("Base64 reference images for style"),
//     aspect_ratio: z.string().optional().describe("Output aspect ratio, e.g. '16:9', '1:1'"),
//     resolution: z.string().optional().describe("Output resolution, e.g. '720p'"),
//     frame_num: z.number().optional().describe("Number of frames (controls duration)"),
//     fps: z.number().optional().describe("Frames per second"),
//     speed_mode: z.string().optional().describe("Generation speed hint"),
//     seed: z.number().optional().describe("Seed for reproducibility"),
//   }),
//   output_schema: z.object({
//     video: z.string().describe("Base64-encoded video data"),
//     mime_type: z.string().describe("MIME type of the generated video"),
//   }),
//   input: {
//     prompt: "A cat wearing sunglasses walking down a city street",
//     aspect_ratio: "16:9",
//     frame_num: 120,  // 120 frames at 24fps = ~5 seconds
//     fps: 24,
//   },
//   model: "openai/sora-2",
// });
