// Streaming function execution
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

process.stdout.write("Streaming: ");

for await (const chunk of opper.stream("sdk-test-explain", {
  output: z.object({ explanation: z.string() }),
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
  // Once completed you have access to the full output and metadata, without needing to accumulate the content deltas yourself.
  if (chunk.type === "complete") {
    console.log("Final Output ##########")
    console.log("Output:", chunk.data.explanation);
    console.log("Meta:", chunk.meta);
  }
  if (chunk.type === "error") {
    console.error("Stream error:", chunk.error);
  }
}
