import { z } from "zod";
import { Opper } from "opperai";

const opper = new Opper();

const result = await opper.call("get_capital", {
  instructions: "Return the capital of the given country.",
  input: { country: "Sweden" },
  output_schema: z.object({
    capital: z.string(),
    population: z.number().optional(),
  }),
});

console.log(result.data.capital);
