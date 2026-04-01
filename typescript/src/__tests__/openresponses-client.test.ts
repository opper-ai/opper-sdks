import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenResponsesClient } from "../clients/openresponses.js";
import type { ORRequest, ORResponse, ORStreamEvent } from "../agent/types.js";
import { ApiError } from "../types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "content-length": "100" }),
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

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

/** Build a minimal valid ORResponse. */
function makeORResponse(overrides: Partial<ORResponse> = {}): ORResponse {
  return {
    id: "resp_001",
    object: "response",
    status: "completed",
    created_at: 1700000000,
    model: "anthropic/claude-sonnet-4-6",
    output: [],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenResponsesClient", () => {
  const config = { apiKey: "test-key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -------------------------------------------------------------------------
  // create() — non-streaming
  // -------------------------------------------------------------------------

  describe("create()", () => {
    it("sends POST to /v3/compat/openresponses", async () => {
      const resp = makeORResponse();
      const fetchMock = mockFetch(resp);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      await client.create({ input: "Hello" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.test.com/v3/compat/openresponses");
      expect(init.method).toBe("POST");
    });

    it("sends stream: false in the request body", async () => {
      const fetchMock = mockFetch(makeORResponse());
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      await client.create({ input: "Hello", model: "test-model" });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.stream).toBe(false);
      expect(body.input).toBe("Hello");
      expect(body.model).toBe("test-model");
    });

    it("returns parsed ORResponse", async () => {
      const resp = makeORResponse({
        output: [
          {
            type: "message",
            id: "msg_001",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "Hello there!" }],
          },
        ],
      });
      const fetchMock = mockFetch(resp);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const result = await client.create({ input: "Hi" });

      expect(result.id).toBe("resp_001");
      expect(result.status).toBe("completed");
      expect(result.output).toHaveLength(1);
      expect(result.output[0].type).toBe("message");
      expect(result.usage?.input_tokens).toBe(100);
    });

    it("sends full ORRequest fields", async () => {
      const fetchMock = mockFetch(makeORResponse());
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const request: ORRequest = {
        input: [{ type: "message", role: "user", content: "Hello" }],
        instructions: "Be helpful",
        model: "anthropic/claude-sonnet-4-6",
        tools: [
          {
            type: "function",
            name: "get_weather",
            description: "Get the weather",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
              required: ["city"],
            },
          },
        ],
        temperature: 0.7,
        max_output_tokens: 4096,
        text: {
          format: {
            type: "json_schema",
            name: "output",
            schema: { type: "object", properties: { answer: { type: "string" } } },
          },
        },
        reasoning: { effort: "medium" },
      };

      await client.create(request);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.instructions).toBe("Be helpful");
      expect(body.tools).toHaveLength(1);
      expect(body.tools[0].name).toBe("get_weather");
      expect(body.temperature).toBe(0.7);
      expect(body.max_output_tokens).toBe(4096);
      expect(body.text.format.type).toBe("json_schema");
      expect(body.reasoning.effort).toBe("medium");
      expect(body.stream).toBe(false);
    });

    it("includes Authorization header", async () => {
      const fetchMock = mockFetch(makeORResponse());
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      await client.create({ input: "test" });

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer test-key");
    });

    it("throws ApiError on non-OK response", async () => {
      const fetchMock = mockFetch({ error: "bad request" }, 400);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      await expect(client.create({ input: "test" })).rejects.toThrow(ApiError);
    });

    it("returns response with function_call output items", async () => {
      const resp = makeORResponse({
        output: [
          {
            type: "function_call",
            id: "fc_001",
            call_id: "call_abc",
            name: "get_weather",
            arguments: '{"city":"London"}',
            status: "completed",
          },
        ],
      });
      const fetchMock = mockFetch(resp);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const result = await client.create({ input: "What's the weather?" });

      expect(result.output).toHaveLength(1);
      const fc = result.output[0];
      expect(fc.type).toBe("function_call");
      if (fc.type === "function_call") {
        expect(fc.call_id).toBe("call_abc");
        expect(fc.name).toBe("get_weather");
        expect(fc.arguments).toBe('{"city":"London"}');
      }
    });
  });

  // -------------------------------------------------------------------------
  // createStream() — streaming
  // -------------------------------------------------------------------------

  describe("createStream()", () => {
    it("sends POST with stream: true", async () => {
      const fetchMock = mockStreamFetch(["data: [DONE]\n\n"]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "Hello" })) {
        events.push(event);
      }

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.test.com/v3/compat/openresponses");
      const body = JSON.parse(init.body);
      expect(body.stream).toBe(true);
    });

    it("yields text delta events", async () => {
      const fetchMock = mockStreamFetch([
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"Hello"}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":" world"}\n\n',
        "data: [DONE]\n\n",
      ]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "Hi" })) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("response.output_text.delta");
      if (events[0].type === "response.output_text.delta") {
        expect(events[0].delta).toBe("Hello");
        expect(events[0].output_index).toBe(0);
      }
      if (events[1].type === "response.output_text.delta") {
        expect(events[1].delta).toBe(" world");
      }
    });

    it("yields function call argument delta and done events", async () => {
      const fetchMock = mockStreamFetch([
        'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"call_id":"call_abc","delta":"{\\"city\\""}\n\n',
        'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"call_id":"call_abc","delta":":\\"London\\"}"}\n\n',
        'event: response.function_call_arguments.done\ndata: {"type":"response.function_call_arguments.done","output_index":0,"call_id":"call_abc","arguments":"{\\"city\\":\\"London\\"}"}\n\n',
        "data: [DONE]\n\n",
      ]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "Weather?" })) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe("response.function_call_arguments.delta");
      expect(events[2].type).toBe("response.function_call_arguments.done");
      if (events[2].type === "response.function_call_arguments.done") {
        expect(events[2].call_id).toBe("call_abc");
        expect(events[2].arguments).toBe('{"city":"London"}');
      }
    });

    it("yields response lifecycle events", async () => {
      const resp = makeORResponse();
      const fetchMock = mockStreamFetch([
        `event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: resp })}\n\n`,
        `event: response.in_progress\ndata: ${JSON.stringify({ type: "response.in_progress", response: resp })}\n\n`,
        `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { ...resp, status: "completed" } })}\n\n`,
        "data: [DONE]\n\n",
      ]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "Hi" })) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe("response.created");
      expect(events[1].type).toBe("response.in_progress");
      expect(events[2].type).toBe("response.completed");
      if (events[2].type === "response.completed") {
        expect(events[2].response.status).toBe("completed");
        expect(events[2].response.id).toBe("resp_001");
      }
    });

    it("yields output_item.added and output_item.done events", async () => {
      const item = {
        type: "message" as const,
        id: "msg_001",
        role: "assistant" as const,
        status: "completed",
        content: [{ type: "output_text", text: "Hello!" }],
      };
      const fetchMock = mockStreamFetch([
        `event: response.output_item.added\ndata: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item })}\n\n`,
        `event: response.output_item.done\ndata: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item })}\n\n`,
        "data: [DONE]\n\n",
      ]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "Hi" })) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("response.output_item.added");
      if (events[0].type === "response.output_item.added") {
        expect(events[0].item.type).toBe("message");
        expect(events[0].output_index).toBe(0);
      }
    });

    it("yields error events", async () => {
      const fetchMock = mockStreamFetch([
        'event: error\ndata: {"type":"error","error":{"code":"server_error","message":"Something went wrong"}}\n\n',
        "data: [DONE]\n\n",
      ]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "Hi" })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("error");
      if (events[0].type === "error") {
        expect(events[0].error.code).toBe("server_error");
        expect(events[0].error.message).toBe("Something went wrong");
      }
    });

    it("handles full streaming conversation with tool call", async () => {
      const resp = makeORResponse({
        output: [
          {
            type: "function_call",
            id: "fc_001",
            call_id: "call_abc",
            name: "get_weather",
            arguments: '{"city":"London"}',
            status: "completed",
          },
        ],
      });

      const fetchMock = mockStreamFetch([
        `event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: { ...resp, status: "in_progress", output: [] } })}\n\n`,
        `event: response.output_item.added\ndata: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { type: "function_call", id: "fc_001", call_id: "call_abc", name: "get_weather", arguments: "", status: "in_progress" } })}\n\n`,
        'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"call_id":"call_abc","delta":"{\\"city\\":"}\n\n',
        'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"call_id":"call_abc","delta":"\\"London\\"}"}\n\n',
        `event: response.function_call_arguments.done\ndata: ${JSON.stringify({ type: "response.function_call_arguments.done", output_index: 0, call_id: "call_abc", arguments: '{"city":"London"}' })}\n\n`,
        `event: response.output_item.done\ndata: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item: resp.output[0] })}\n\n`,
        `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: resp })}\n\n`,
        "data: [DONE]\n\n",
      ]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "Weather in London?" })) {
        events.push(event);
      }

      expect(events).toHaveLength(7);

      // Verify we got the key events
      const types = events.map((e) => e.type);
      expect(types).toContain("response.created");
      expect(types).toContain("response.output_item.added");
      expect(types).toContain("response.function_call_arguments.delta");
      expect(types).toContain("response.function_call_arguments.done");
      expect(types).toContain("response.output_item.done");
      expect(types).toContain("response.completed");

      // Verify the completed event has the full response
      const completed = events.find((e) => e.type === "response.completed");
      if (completed?.type === "response.completed") {
        expect(completed.response.output).toHaveLength(1);
        expect(completed.response.output[0].type).toBe("function_call");
      }
    });

    it("throws ApiError on non-OK response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ error: "invalid key" }),
      });
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      await expect(async () => {
        for await (const _ of client.createStream({ input: "test" })) {
          // consume
        }
      }).rejects.toThrow(ApiError);
    });

    it("handles empty body gracefully", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        body: null,
      });
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "test" })) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
    });

    it("skips SSE comments and empty lines", async () => {
      const fetchMock = mockStreamFetch([
        ": this is a comment\n\n",
        "\n",
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"Hi"}\n\n',
        ": another comment\n\n",
        "data: [DONE]\n\n",
      ]);
      globalThis.fetch = fetchMock;

      const client = new OpenResponsesClient(config);
      const events: ORStreamEvent[] = [];
      for await (const event of client.createStream({ input: "test" })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("response.output_text.delta");
    });
  });
});
