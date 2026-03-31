import { Opper } from "opperai";

const opper = new Opper();

await opper.spans.update("span-id", {
  output: "Pipeline completed successfully",
  end_time: new Date().toISOString(),
  meta: { total_calls: 3 },
});
