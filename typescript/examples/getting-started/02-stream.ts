// Streaming function execution
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

process.stdout.write("Streaming: ");

for await (const chunk of opper.stream("sdk-test-explain", {
  output: z.object({ explanation: z.string() }),
  input_schema: z.object({ topic: z.string() }),
  input: { topic: "How do SSE streams work?" },
})) {
  if (chunk.type === "content") {
    process.stdout.write(chunk.delta);
  }
  if (chunk.type === "done") {
    console.log();
    console.log("Usage:", chunk.usage);
  }
  if (chunk.type === "error") {
    console.error("Stream error:", chunk.error);
  }
}
