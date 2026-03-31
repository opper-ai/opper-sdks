import { Opper } from "opperai";

const opper = new Opper();

const span = await opper.spans.getSpan("span-id");
console.log(`Name: ${span.name}, Trace: ${span.trace_id}`);
