import { Opper } from "opperai";

const opper = new Opper();

const traces = await opper.traces.listTraces({ limit: 5 });
for (const t of traces.data) {
  console.log(`${t.id} - ${t.name ?? "(unnamed)"} (${t.span_count} spans)`);
}
