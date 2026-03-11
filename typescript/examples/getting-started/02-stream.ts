// Streaming function execution
import { Opper } from "../../src/index.js";

const client = new Opper();

process.stdout.write("Streaming: ");

for await (const chunk of client.stream("sdk-test/explain", {
  input_schema: {
    type: "object",
    properties: { topic: { type: "string" } },
    required: ["topic"],
  },
  output_schema: {
    type: "object",
    properties: { explanation: { type: "string" } },
    required: ["explanation"],
  },
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
