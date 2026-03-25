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

// ══════════════════════════════════════════════════════════════════════════════
// Option 1: Convenience methods
// ══════════════════════════════════════════════════════════════════════════════

const easyTts = await opper.textToSpeech("sdk-test-tts", {
  text: "Hello! This is a test of the Opper text-to-speech API. Pretty cool, right?",
  // voice: "alloy",
});

console.log("── TTS (convenience) ──");
console.log("Audio base64 length:", easyTts.data.audio.length);

const ttsPath = easyTts.save(resolve(__dirname, "media/generated-speech.mp3"));
console.log(`Saved to ${ttsPath}`);

const easyStt = await opper.transcribe("sdk-test-stt", {
  audio: easyTts.data.audio,
});

console.log("\n── STT (convenience) ──");
console.log("Transcription:", easyStt.data.text);
console.log("Language:", easyStt.data.language);

// ══════════════════════════════════════════════════════════════════════════════
// Option 2: Raw call() with explicit schemas
// ══════════════════════════════════════════════════════════════════════════════

const rawTts = await opper.call("sdk-test-tts-raw", {
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

console.log("\n── TTS (raw call) ──");
console.log("Audio base64 length:", rawTts.data.audio.length);

const rawTtsPath = resolve(__dirname, "media/generated-speech-raw.mp3");
writeFileSync(rawTtsPath, Buffer.from(rawTts.data.audio, "base64"));
console.log(`Saved to ${rawTtsPath}`);

const rawStt = await opper.call("sdk-test-stt-raw", {
  input_schema: z.object({
    audio: z.string().describe("Base64-encoded audio to transcribe"),
  }),
  output_schema: z.object({
    text: z.string().describe("Transcribed text"),
    language: z.string().describe("Detected language code"),
  }),
  input: {
    audio: rawTts.data.audio,
  },
});

console.log("\n── STT (raw call) ──");
console.log("Transcription:", rawStt.data.text);
console.log("Language:", rawStt.data.language);
