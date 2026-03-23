// Streaming function execution
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

console.log("── Streaming deltas ──");
process.stdout.write("");

for await (const chunk of opper.stream("sdk-test-explain", {
  output_schema: z.object({ explanation: z.string() }),
  input: { topic: "How do SSE streams work?" },
  model: "anthropic/claude-sonnet-4.6",
})) {
  if (chunk.type === "content") {
    process.stdout.write(chunk.delta);
  }
  if (chunk.type === "done") {
    console.log();
    console.log("Usage:", chunk.usage);
  }

  // The "complete" event gives you the fully parsed & typed output in one shot,
  // so you don't need to accumulate the content deltas yourself.
  if (chunk.type === "complete") {
    console.log("\n── Accumulated output (from complete event) ──");
    console.log("Output:", chunk.data.explanation);
    console.log("Meta:", chunk.meta);
  }
  if (chunk.type === "error") {
    console.error("Stream error:", chunk.error);
  }
}
