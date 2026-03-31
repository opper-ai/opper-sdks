import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("analyze-sentiment", {
  instructions: "Analyze the sentiment of the given text",
  input: { text: "The product launch exceeded all expectations!" },
  output_schema: z.object({
    sentiment: z.string(),
    confidence: z.number(),
    reasoning: z.string(),
  }),
});

console.log(result.data.sentiment, result.data.confidence);
console.log(result.data.reasoning);
