import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("my-function", {
  input: { text: "Summarize this" },
  output_schema: z.object({ summary: z.string() }),
});
console.log(result.data);
