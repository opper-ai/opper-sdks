import { writeFileSync } from "node:fs";
import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("generate-image", {
  instructions: "Generate an image based on the description",
  input: { description: "A serene mountain landscape at sunset" },
  output_schema: z.object({
    image: z.string(), // base64-encoded PNG
  }),
});

writeFileSync("output.png", Buffer.from(result.data.image, "base64"));
console.log("Saved to output.png");
