import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

// setup -- generate audio via TTS so the snippet is self-contained
const tts = await opper.textToSpeech("docs-snippet-tts", { text: "Hello, this is a test of the speech API." });
const audioB64 = tts.data.audio;
// /setup

// --- docs ---
const result = await opper.call("audio-transcribe", {
  instructions: "Transcribe the audio accurately",
  input: { audio: audioB64 },
  input_schema: z.object({
    audio: z.string().describe("base64-encoded audio"),
  }),
  output_schema: z.object({
    transcription: z.string(),
  }),
});

console.log("Transcription:", result.data.transcription);
// --- /docs ---
