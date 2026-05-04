import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, Conversation, tool } from "../agent/index.js";
import type { ORResponse } from "../agent/types.js";
import { mockSSEResponseFromOR } from "./_helpers/sse.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function textResponse(text: string, overrides: Partial<ORResponse> = {}): ORResponse {
  return makeORResponse({
    output: [
      {
        type: "message",
        id: "msg_001",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text }],
      },
    ],
    ...overrides,
  });
}

function toolCallResponse(
  calls: Array<{ call_id: string; name: string; arguments: string }>,
  overrides: Partial<ORResponse> = {},
): ORResponse {
  return makeORResponse({
    output: calls.map((call, i) => ({
      type: "function_call" as const,
      id: `fc_${i}`,
      call_id: call.call_id,
      name: call.name,
      arguments: call.arguments,
      status: "completed",
    })),
    ...overrides,
  });
}

function mockFetchSequence(responses: ORResponse[]) {
  let callIndex = 0;
  return vi.fn().mockImplementation(async () => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    return mockSSEResponseFromOR(resp);
  });
}

function makeAgent(overrides: Record<string, unknown> = {}) {
  return new Agent({
    name: "test-agent",
    instructions: "You are a helpful assistant.",
    tracing: false,
    client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Conversation", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("creates a conversation from an agent", () => {
    const agent = makeAgent();
    const conv = agent.conversation();
    expect(conv).toBeInstanceOf(Conversation);
    expect(conv.getItems()).toEqual([]);
  });

  it("sends a message and accumulates history", async () => {
    const mockFetch = mockFetchSequence([
      textResponse("Hello! How can I help?"),
      textResponse("Your name is Alice."),
    ]);
    globalThis.fetch = mockFetch;

    const agent = makeAgent();
    const conv = agent.conversation();

    const r1 = await conv.send("My name is Alice.");
    expect(r1.output).toBe("Hello! How can I help?");

    const r2 = await conv.send("What is my name?");
    expect(r2.output).toBe("Your name is Alice.");

    // History should contain both turns
    const items = conv.getItems();
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ type: "message", role: "user", content: "My name is Alice." });
    expect(items[1]).toEqual({ type: "message", role: "assistant", content: "Hello! How can I help?" });
    expect(items[2]).toEqual({ type: "message", role: "user", content: "What is my name?" });
    expect(items[3]).toEqual({ type: "message", role: "assistant", content: "Your name is Alice." });
  });

  it("sends full history to the agent on each call", async () => {
    const mockFetch = mockFetchSequence([
      textResponse("Got it."),
      textResponse("Second response."),
    ]);
    globalThis.fetch = mockFetch;

    const agent = makeAgent();
    const conv = agent.conversation();

    await conv.send("First message");
    await conv.send("Second message");

    // The second call should have received the full history: user + assistant + user
    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondCallBody.input).toHaveLength(3);
    expect(secondCallBody.input[0]).toMatchObject({ role: "user", content: "First message" });
    expect(secondCallBody.input[1]).toMatchObject({ role: "assistant", content: "Got it." });
    expect(secondCallBody.input[2]).toMatchObject({ role: "user", content: "Second message" });
  });

  it("tracks tool calls in conversation history", async () => {
    const greetTool = tool({
      name: "greet",
      description: "Greet someone",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      execute: async (params: unknown) => {
        const { name } = params as { name: string };
        return { greeting: `Hello, ${name}!` };
      },
    });

    const mockFetch = mockFetchSequence([
      // First call: model calls the greet tool
      toolCallResponse([
        { call_id: "call_1", name: "greet", arguments: '{"name":"Alice"}' },
      ]),
      // Second call: model responds with text after tool result
      textResponse("I greeted Alice for you!"),
      // Third call: second turn
      textResponse("I remember greeting Alice."),
    ]);
    globalThis.fetch = mockFetch;

    const agent = makeAgent({ tools: [greetTool] });
    const conv = agent.conversation();

    const r1 = await conv.send("Greet Alice");
    expect(r1.output).toBe("I greeted Alice for you!");
    expect(r1.meta.toolCalls).toHaveLength(1);

    // History should include the tool call items
    const itemsAfterFirst = conv.getItems();
    expect(itemsAfterFirst.some((i) => i.type === "function_call")).toBe(true);
    expect(itemsAfterFirst.some((i) => i.type === "function_call_output")).toBe(true);

    const r2 = await conv.send("Who did you greet?");
    expect(r2.output).toBe("I remember greeting Alice.");
  });

  it("clears conversation history", async () => {
    const mockFetch = mockFetchSequence([textResponse("Hello!")]);
    globalThis.fetch = mockFetch;

    const agent = makeAgent();
    const conv = agent.conversation();

    await conv.send("Hi");
    expect(conv.getItems()).toHaveLength(2);

    conv.clear();
    expect(conv.getItems()).toEqual([]);
  });

  it("returns readonly items array", () => {
    const agent = makeAgent();
    const conv = agent.conversation();
    const items = conv.getItems();
    expect(Array.isArray(items)).toBe(true);
  });

  it("streams a conversation turn and updates history on result()", async () => {
    // Build a simple SSE stream for streaming test
    const sseData = [
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","output_index":0,"delta":"Streamed "}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","output_index":0,"delta":"response."}\n\n',
      `event: response.completed\ndata: ${JSON.stringify({
        type: "response.completed",
        response: textResponse("Streamed response."),
      })}\n\n`,
    ].join("");

    const encoder = new TextEncoder();
    let streamCallCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      streamCallCount++;
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: readable,
      };
    });

    const agent = makeAgent();
    const conv = agent.conversation();

    const stream = conv.stream("Hello streaming");

    // Consume the stream
    const chunks: string[] = [];
    for await (const event of stream) {
      if (event.type === "text_delta") {
        chunks.push(event.text);
      }
    }

    expect(chunks.join("")).toBe("Streamed response.");

    // History should be updated after result()
    const result = await stream.result();
    expect(result.output).toBe("Streamed response.");

    const items = conv.getItems();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ type: "message", role: "user", content: "Hello streaming" });
    expect(items[1]).toEqual({ type: "message", role: "assistant", content: "Streamed response." });
  });
});
