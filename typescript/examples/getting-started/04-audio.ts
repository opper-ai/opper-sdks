// Audio-related function execution (token tracking)
import { Opper } from "../../src/index.js";

const client = new Opper();

const result = await client.run("sdk-test/transcription-summary", {
  input_schema: {
    type: "object",
    properties: {
      transcript: { type: "string" },
      language: { type: "string" },
    },
    required: ["transcript"],
  },
  output_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      key_points: { type: "array", items: { type: "string" } },
      language_detected: { type: "string" },
    },
    required: ["summary", "key_points"],
  },
  input: {
    transcript:
      "Welcome everyone to today's meeting. We'll be discussing the Q3 roadmap. First, let's review the metrics from last quarter. Revenue grew 15% quarter over quarter. Our activation rate improved to 34%. Next steps: we need to finalize the pricing model and launch the new SDK by end of month.",
  },
});

const output = result.output as {
  summary: string;
  key_points: string[];
  language_detected?: string;
};
console.log("Summary:", output.summary);
console.log("Key points:", output.key_points);
console.log("Usage:", result.meta?.usage);
