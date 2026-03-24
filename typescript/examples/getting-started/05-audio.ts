// Audio: text-to-speech and speech-to-text in one flow.
// Part 1 generates speech from text via the tts() builtin.
// Part 2 transcribes audio back to text via the stt() builtin.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Opper } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const opper = new Opper();

// ── Part 1: Text-to-Speech ─────────────────────────────────────────────────

const ttsResult = await opper.call("sdk-test-tts", {
  input_schema: z.object({
    text: z.string().describe("Text to convert to speech"),
  }),
  output_schema: z.object({
    audio: z.string().describe("Base64-encoded audio data"),
  }),
  input: {
    text: "Hello! This is a test of the Opper text-to-speech API. Pretty cool, right?",
  },
});

console.log("── Text-to-Speech ──");
console.log("Audio base64 length:", ttsResult.data.audio.length);

// Save to file for playback
const outPath = resolve(__dirname, "media/generated-speech.mp3");
writeFileSync(outPath, Buffer.from(ttsResult.data.audio, "base64"));
console.log(`Saved to ${outPath} — open it to listen!`);

// ── Part 2: Speech-to-Text (transcribe the audio we just generated) ────────

const sttResult = await opper.call("sdk-test-stt", {
  input_schema: z.object({
    audio: z.string().describe("Base64-encoded audio to transcribe"),
  }),
  output_schema: z.object({
    text: z.string().describe("Transcribed text"),
    language: z.string().describe("Detected language code"),
  }),
  input: {
    audio: ttsResult.data.audio,
  },
});

console.log("\n── Speech-to-Text ──");
console.log("Transcription:", sttResult.data.text);
console.log("Language:", sttResult.data.language);
