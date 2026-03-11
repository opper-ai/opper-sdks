import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsClient } from "../clients/functions.js";
import type { StreamChunk } from "../types.js";

function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = events.join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

function mockStreamFetch(events: string[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    body: createSSEStream(events),
  });
}

describe("FunctionsClient.streamFunction", () => {
  const config = { apiKey: "test-key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to /v3/functions/{name}/stream", async () => {
    const fetchMock = mockStreamFetch(["data: [DONE]\n\n"]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const chunks: StreamChunk[] = [];
    for await (const chunk of client.streamFunction("my-fn", {
      input_schema: {},
      output_schema: {},
      input: {},
    })) {
      chunks.push(chunk);
    }

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/stream");
    expect(init.method).toBe("POST");
  });

  it("yields content chunks", async () => {
    const fetchMock = mockStreamFetch([
      'data: {"type":"content","delta":"Hello"}\n\n',
      'data: {"type":"content","delta":" world"}\n\n',
      "data: [DONE]\n\n",
    ]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const chunks: StreamChunk[] = [];
    for await (const chunk of client.streamFunction("fn", {
      input_schema: {},
      output_schema: {},
      input: {},
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0].type).toBe("content");
    expect(chunks[0].delta).toBe("Hello");
    expect(chunks[1].delta).toBe(" world");
  });

  it("handles tool_call_start chunks", async () => {
    const fetchMock = mockStreamFetch([
      'data: {"type":"tool_call_start","tool_call_index":0,"tool_call_id":"call_123","tool_call_name":"get_metric"}\n\n',
      "data: [DONE]\n\n",
    ]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const chunks: StreamChunk[] = [];
    for await (const chunk of client.streamFunction("fn", {
      input_schema: {},
      output_schema: {},
      input: {},
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("tool_call_start");
    expect(chunks[0].tool_call_id).toBe("call_123");
    expect(chunks[0].tool_call_name).toBe("get_metric");
    expect(chunks[0].tool_call_index).toBe(0);
  });

  it("handles tool_call_delta chunks", async () => {
    const fetchMock = mockStreamFetch([
      'data: {"type":"tool_call_delta","tool_call_index":0,"tool_call_args":"{\\"metric\\":"}\n\n',
      'data: {"type":"tool_call_delta","tool_call_index":0,"tool_call_args":"\\"dau\\"}"}\n\n',
      "data: [DONE]\n\n",
    ]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const chunks: StreamChunk[] = [];
    for await (const chunk of client.streamFunction("fn", {
      input_schema: {},
      output_schema: {},
      input: {},
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0].type).toBe("tool_call_delta");
    expect(chunks[0].tool_call_args).toBe('{"metric":');
  });

  it("handles done chunk with usage", async () => {
    const fetchMock = mockStreamFetch([
      'data: {"type":"done","usage":{"input_tokens":100,"output_tokens":50}}\n\n',
      "data: [DONE]\n\n",
    ]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const chunks: StreamChunk[] = [];
    for await (const chunk of client.streamFunction("fn", {
      input_schema: {},
      output_schema: {},
      input: {},
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("done");
    expect(chunks[0].usage.input_tokens).toBe(100);
    expect(chunks[0].usage.output_tokens).toBe(50);
  });

  it("handles error chunk", async () => {
    const fetchMock = mockStreamFetch([
      'data: {"type":"error","error":"something went wrong"}\n\n',
      "data: [DONE]\n\n",
    ]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const chunks: StreamChunk[] = [];
    for await (const chunk of client.streamFunction("fn", {
      input_schema: {},
      output_schema: {},
      input: {},
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error).toBe("something went wrong");
  });

  it("handles full stream with all chunk types", async () => {
    const fetchMock = mockStreamFetch([
      'data: {"type":"content","delta":"Hello"}\n\n',
      'data: {"type":"tool_call_start","tool_call_index":0,"tool_call_id":"c1","tool_call_name":"search"}\n\n',
      'data: {"type":"tool_call_delta","tool_call_index":0,"tool_call_args":"{\\"q\\":\\"test\\"}"}\n\n',
      'data: {"type":"done","usage":{"input_tokens":10,"output_tokens":5}}\n\n',
      "data: [DONE]\n\n",
    ]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const types: string[] = [];
    for await (const chunk of client.streamFunction("fn", {
      input_schema: {},
      output_schema: {},
      input: {},
    })) {
      types.push(chunk.type);
    }

    expect(types).toEqual(["content", "tool_call_start", "tool_call_delta", "done"]);
  });
});
