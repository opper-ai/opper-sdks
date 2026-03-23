// Audio-related function execution (token tracking)
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

const result = await opper.call("sdk-test-transcription-summary", {
  output_schema: z.object({
    summary: z.string(),
    key_points: z.array(z.string()),
    language_detected: z.string().optional(),
  }),
  input: {
    transcript:
      "Welcome everyone to today's meeting. We'll be discussing the Q3 roadmap. First, let's review the metrics from last quarter. Revenue grew 15% quarter over quarter. Our activation rate improved to 34%. Next steps: we need to finalize the pricing model and launch the new SDK by end of month.",
  },
});

console.log("Summary:", result.data.summary); // typed!
console.log("Key points:", result.data.key_points); // typed!
console.log("Usage:", result.meta?.usage);
