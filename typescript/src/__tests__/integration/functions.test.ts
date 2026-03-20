import { describe, expect, it } from "vitest";
import { Opper } from "../../index.js";

const SKIP = !process.env.OPPER_API_KEY;

describe.skipIf(SKIP)("Integration: functions", () => {
  it("runs a function and returns output", async () => {
    const client = new Opper();

    const result = await client.run("sdk-integration-test", {
      input_schema: {
        type: "object",
        properties: { question: { type: "string" } },
      },
      output_schema: {
        type: "object",
        properties: { answer: { type: "string" } },
      },
      input: { question: "What is 2+2?" },
    });

    expect(result.data).toBeDefined();
    expect(result.meta).toBeDefined();
  });

  it("streams a function execution", async () => {
    const client = new Opper();

    const chunks = [];
    for await (const chunk of client.stream("sdk-integration-test", {
      input_schema: {
        type: "object",
        properties: { question: { type: "string" } },
      },
      output_schema: {
        type: "object",
        properties: { answer: { type: "string" } },
      },
      input: { question: "What is 2+2?" },
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const types = chunks.map((c) => c.type);
    expect(types).toContain("done");
  });
});
