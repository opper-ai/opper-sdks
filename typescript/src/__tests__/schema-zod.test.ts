import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Opper } from "../index.js";
import { toJsonSchema } from "../schema.js";

describe("toJsonSchema with Zod", () => {
  it("extracts JSON Schema from a Zod object schema", async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const result = await toJsonSchema(schema);

    expect(result.type).toBe("object");
    expect(result.properties).toBeDefined();
    const props = result.properties as Record<string, { type: string }>;
    expect(props.name.type).toBe("string");
    expect(props.age.type).toBe("number");
  });

  it("strips Zod auto-added safe-integer bounds from z.number().int()", async () => {
    const schema = z.object({
      count: z.number().int(),
    });

    const result = await toJsonSchema(schema);
    const props = result.properties as Record<string, Record<string, unknown>>;

    expect(props.count.type).toBe("integer");
    expect(props.count.minimum).toBeUndefined();
    expect(props.count.maximum).toBeUndefined();
  });

  it("preserves user-specified bounds on integer types", async () => {
    const schema = z.object({
      age: z.number().int().min(0).max(150),
    });

    const result = await toJsonSchema(schema);
    const props = result.properties as Record<string, Record<string, unknown>>;

    expect(props.age.type).toBe("integer");
    expect(props.age.minimum).toBe(0);
    expect(props.age.maximum).toBe(150);
  });

  it("strips safe-integer bounds from nested integer types", async () => {
    const schema = z.object({
      items: z.array(z.object({ qty: z.number().int() })),
    });

    const result = await toJsonSchema(schema);
    const items = result.properties as Record<string, Record<string, unknown>>;
    const innerProps = (items.items.items as Record<string, unknown>).properties as Record<
      string,
      Record<string, unknown>
    >;

    expect(innerProps.qty.type).toBe("integer");
    expect(innerProps.qty.minimum).toBeUndefined();
    expect(innerProps.qty.maximum).toBeUndefined();
  });

  it("extracts JSON Schema from a Zod array schema", async () => {
    const schema = z.array(z.string());
    const result = await toJsonSchema(schema);

    expect(result.type).toBe("array");
    expect((result.items as { type: string }).type).toBe("string");
  });
});

describe("Opper.run with Zod schema", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("converts Zod schema to output_schema on the wire", async () => {
    const responseBody = JSON.stringify({
      data: { name: "Marie", role: "scientist" },
      meta: {
        function_name: "extract",
        execution_ms: 100,
        llm_calls: 1,
        tts_calls: 0,
        image_gen_calls: 0,
        script_cached: false,
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(responseBody),
    });
    globalThis.fetch = fetchMock;

    const client = new Opper({ apiKey: "test-key" });

    const result = await client.call("extract", {
      output_schema: z.object({ name: z.string(), role: z.string() }),
      input: "Marie Curie was a scientist",
    });

    // Verify the wire request has output_schema as JSON Schema
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.output_schema).toBeDefined();
    expect(body.output_schema.type).toBe("object");

    // Verify the response
    expect(result.data.name).toBe("Marie");
    expect(result.data.role).toBe("scientist");
  });

  it("resolves Zod input_schema and tool parameters on the wire", async () => {
    const responseBody = JSON.stringify({
      data: { answer: "42" },
      meta: {
        function_name: "ask",
        execution_ms: 50,
        llm_calls: 1,
        tts_calls: 0,
        image_gen_calls: 0,
        script_cached: false,
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(responseBody),
    });
    globalThis.fetch = fetchMock;

    const client = new Opper({ apiKey: "test-key" });

    await client.call("ask", {
      output_schema: z.object({ answer: z.string() }),
      input_schema: z.object({ question: z.string() }),
      input: { question: "What is the meaning of life?" },
      tools: [
        {
          name: "lookup",
          description: "Look something up",
          parameters: z.object({ query: z.string() }),
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);

    // input_schema resolved from Zod
    expect(body.input_schema).toBeDefined();
    expect(body.input_schema.type).toBe("object");
    const inputProps = body.input_schema.properties as Record<string, { type: string }>;
    expect(inputProps.question.type).toBe("string");

    // tool parameters resolved from Zod
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe("lookup");
    expect(body.tools[0].parameters.type).toBe("object");
    const toolProps = body.tools[0].parameters.properties as Record<string, { type: string }>;
    expect(toolProps.query.type).toBe("string");
  });
});
