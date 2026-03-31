import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const audioB64 = readFileSync("input.wav").toString("base64");

const result = await opper.call("audio-summarize", {
  instructions: "Listen to the audio and provide a text summary and an audio narration of the summary",
  input: { audio: audioB64 },
  input_schema: z.object({
    audio: z.string().describe("base64-encoded WAV audio"),
  }),
  output_schema: z.object({
    summary: z.string(),
    audio_summary: z.string().describe("base64-encoded WAV audio"),
  }),
});

console.log("Summary:", result.data.summary);
writeFileSync("summary.wav", Buffer.from(result.data.audio_summary, "base64"));
