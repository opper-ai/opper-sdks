// Video generation via the video_gen builtin.
// Videos are generated asynchronously — the convenience method handles
// polling and downloading automatically. The schema-driven call() shows
// the raw pending operations flow.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mediaDir = resolve(__dirname, "media");
const opper = new Opper();

// ── Option 1: Schema-driven call() (manual pending handling) ────────────────

console.log("Generating video (schema-driven)...");
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
  model: "openai/sora-2",
});

console.log("Meta:", raw.meta);

if (raw.meta?.status === "pending" && raw.meta.pending_operations?.length) {
  for (const op of raw.meta.pending_operations) {
    console.log(`Polling artifact ${op.id}...`);
    while (true) {
      const status = await opper.artifacts.getStatus(op.id);
      console.log(`  status: ${status.status}`);
      if (status.status === "completed") {
        const resp = await fetch(status.url!);
        const buf = Buffer.from(await resp.arrayBuffer());
        const outPath = resolve(mediaDir, "generated-video-raw.mp4");
        writeFileSync(outPath, buf);
        console.log(`Saved to ${outPath}`);
        break;
      }
      if (status.status === "failed") {
        console.log(`  error: ${status.error}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
} else {
  const ext = raw.data.mime_type.split("/")[1] || "mp4";
  const outPath = resolve(mediaDir, `generated-video-raw.${ext}`);
  writeFileSync(outPath, Buffer.from(raw.data.video, "base64"));
  console.log(`Saved to ${outPath}`);
}

// ── Option 2: Convenience method (polls + downloads automatically) ──────────

console.log("\nGenerating video (convenience) — polls automatically...");
const easy = await opper.generateVideo("sdk-test-generate-video", {
  prompt: "A cat and a dog playing together in a park",
  model: "openai/sora-2",
});

console.log("Meta:", easy.meta);
const savedPath = easy.save(resolve(mediaDir, "generated-video-convenience"));
console.log(`Saved to ${savedPath}`);
