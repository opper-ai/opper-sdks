import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

// Functions are auto-created on first call
const result = await opper.call("my-new-function", {
  input: { text: "Hello world" },
  input_schema: z.object({ text: z.string() }),
  output_schema: z.object({ summary: z.string() }),
});
console.log(result.data);
