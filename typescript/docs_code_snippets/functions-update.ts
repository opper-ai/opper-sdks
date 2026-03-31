import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const fn = await opper.functions.get("my-function");
// Update is done by calling with new schemas - the function auto-updates
const result = await opper.call("my-function", {
  input: { text: "Updated input" },
  output_schema: z.object({ result: z.string() }),
});
console.log(result.data);
