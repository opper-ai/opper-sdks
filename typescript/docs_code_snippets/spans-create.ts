import { Opper } from "opperai";

const opper = new Opper();

const span = await opper.spans.create({
  name: "my-pipeline",
  start_time: new Date().toISOString(),
  input: "Starting the pipeline",
  meta: { userId: "u-123" },
});
console.log(`Span: ${span.id}, Trace: ${span.trace_id}`);
