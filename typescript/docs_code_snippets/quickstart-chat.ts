import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("chat", {
  instructions: "You are a helpful assistant",
  input: {
    messages: [
      { role: "user", content: "What is the best way to handle retries?" },
      { role: "assistant", content: "Exponential backoff is a common approach." },
      { role: "user", content: "Can you show me a simple example?" },
    ],
  },
  output_schema: z.object({
    reply: z.string(),
    topic: z.string(),
  }),
});

console.log(result.data.reply);
