import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, AgentStream, tool, AgentError, AbortError } from "../agent/index.js";
import type { ORResponse, ORStreamEvent, AgentStreamEvent } from "../agent/types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create an SSE-formatted text chunk from events. */
function sseChunk(events: ORStreamEvent[]): string {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

/** Build a mock Response that streams SSE events via a ReadableStream. */
function mockSSEResponse(events: ORStreamEvent[]): Response {
  const chunks = [sseChunk(events)];
  let chunkIndex = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[chunkIndex++]));
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: stream,
  } as unknown as Response;
}

/** Build a standard non-streaming mock response. */
function mockJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-length": "100" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeCompletedResponse(overrides: Partial<ORResponse> = {}): ORResponse {
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

function makeAgent(overrides: Record<string, unknown> = {}) {
  return new Agent({
    name: "test-agent",
    instructions: "You are a helpful assistant.",
    tracing: false,
    client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    ...overrides,
  });
}

/** Collect all events from a stream. */
async function collectEvents(stream: AgentStream): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent.stream()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("streams text deltas from SSE events", async () => {
    const completedResponse = makeCompletedResponse({
      output: [
        {
          type: "message",
          id: "msg_001",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Hello world" }],
        },
      ],
    });

    const sseEvents: ORStreamEvent[] = [
      { type: "response.created", response: makeCompletedResponse() },
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "Hello" },
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: " world" },
      { type: "response.output_text.done", output_index: 0, content_index: 0, text: "Hello world" },
      { type: "response.completed", response: completedResponse },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent();
    const stream = agent.stream("Hi");
    const events = await collectEvents(stream);

    const textDeltas = events.filter((e) => e.type === "text_delta");
    expect(textDeltas).toHaveLength(2);
    expect(textDeltas[0]).toEqual({ type: "text_delta", text: "Hello" });
    expect(textDeltas[1]).toEqual({ type: "text_delta", text: " world" });

    // Should have iteration_start, iteration_end, and result
    expect(events[0]).toEqual({ type: "iteration_start", iteration: 1 });
    expect(events.find((e) => e.type === "iteration_end")).toBeDefined();
    expect(events.find((e) => e.type === "result")).toBeDefined();
  });

  it("accumulates tool calls from function_call SSE events", async () => {
    // First call: model wants to call a tool
    const toolCallEvents: ORStreamEvent[] = [
      { type: "response.created", response: makeCompletedResponse() },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "function_call",
          id: "fc_0",
          call_id: "call_001",
          name: "get_weather",
          arguments: "",
          status: "in_progress",
        },
      },
      {
        type: "response.function_call_arguments.delta",
        output_index: 0,
        call_id: "call_001",
        delta: '{"city":',
      },
      {
        type: "response.function_call_arguments.delta",
        output_index: 0,
        call_id: "call_001",
        delta: '"Paris"}',
      },
      {
        type: "response.function_call_arguments.done",
        output_index: 0,
        call_id: "call_001",
        arguments: '{"city":"Paris"}',
      },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            {
              type: "function_call",
              id: "fc_0",
              call_id: "call_001",
              name: "get_weather",
              arguments: '{"city":"Paris"}',
              status: "completed",
            },
          ],
        }),
      },
    ];

    // Second call: model responds with text
    const textEvents: ORStreamEvent[] = [
      { type: "response.created", response: makeCompletedResponse() },
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "It's sunny in Paris." },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            {
              type: "message",
              id: "msg_001",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: "It's sunny in Paris." }],
            },
          ],
        }),
      },
    ];

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSSEResponse(toolCallEvents))
      .mockResolvedValueOnce(mockSSEResponse(textEvents));

    const weatherTool = tool({
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      execute: async ({ city }: { city: string }) => ({ weather: "sunny", city }),
    });

    const agent = makeAgent({ tools: [weatherTool] });
    const stream = agent.stream("What's the weather in Paris?");
    const events = await collectEvents(stream);

    // Check tool lifecycle events
    const toolStart = events.find((e) => e.type === "tool_start");
    expect(toolStart).toEqual({
      type: "tool_start",
      name: "get_weather",
      callId: "call_001",
      input: { city: "Paris" },
    });

    const toolEnd = events.find((e) => e.type === "tool_end");
    expect(toolEnd).toMatchObject({
      type: "tool_end",
      name: "get_weather",
      callId: "call_001",
      output: { weather: "sunny", city: "Paris" },
    });
    expect((toolEnd as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);

    // Should have text delta in second iteration
    const textDeltas = events.filter((e) => e.type === "text_delta");
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0]).toEqual({ type: "text_delta", text: "It's sunny in Paris." });
  });

  it("provides result via stream.result()", async () => {
    const completedResponse = makeCompletedResponse({
      output: [
        {
          type: "message",
          id: "msg_001",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "42" }],
        },
      ],
    });

    const sseEvents: ORStreamEvent[] = [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "42" },
      { type: "response.completed", response: completedResponse },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent();
    const stream = agent.stream("What is the answer?");

    // Iterate first
    for await (const _ of stream) {
      // consume
    }

    const result = await stream.result();
    expect(result.output).toBe("42");
    expect(result.meta.iterations).toBe(1);
    expect(result.meta.usage.totalTokens).toBe(150);
  });

  it("result() without iterating drains the stream", async () => {
    const completedResponse = makeCompletedResponse({
      output: [
        {
          type: "message",
          id: "msg_001",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "drained" }],
        },
      ],
    });

    const sseEvents: ORStreamEvent[] = [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "drained" },
      { type: "response.completed", response: completedResponse },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent();
    const stream = agent.stream("drain me");

    // Call result() directly without iterating
    const result = await stream.result();
    expect(result.output).toBe("drained");
  });

  it("throws when iterating stream twice", async () => {
    const sseEvents: ORStreamEvent[] = [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "hi" },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            {
              type: "message",
              id: "msg_001",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: "hi" }],
            },
          ],
        }),
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent();
    const stream = agent.stream("hi");

    // First iteration
    for await (const _ of stream) {}

    // Second iteration should throw
    await expect(async () => {
      for await (const _ of stream) {}
    }).rejects.toThrow("AgentStream can only be iterated once");
  });

  it("yields iteration_start and iteration_end events", async () => {
    const completedResponse = makeCompletedResponse({
      output: [
        {
          type: "message",
          id: "msg_001",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "done" }],
        },
      ],
    });

    const sseEvents: ORStreamEvent[] = [
      { type: "response.completed", response: completedResponse },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent();
    const events = await collectEvents(agent.stream("hi"));

    expect(events[0]).toEqual({ type: "iteration_start", iteration: 1 });

    const iterEnd = events.find((e) => e.type === "iteration_end");
    expect(iterEnd).toMatchObject({ type: "iteration_end", iteration: 1 });
  });

  it("handles multi-iteration streaming with tools", async () => {
    // Iteration 1: two tool calls
    const iter1Events: ORStreamEvent[] = [
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "function_call",
          id: "fc_0",
          call_id: "call_a",
          name: "add",
          arguments: "",
          status: "in_progress",
        },
      },
      {
        type: "response.function_call_arguments.done",
        output_index: 0,
        call_id: "call_a",
        arguments: '{"a":1,"b":2}',
      },
      {
        type: "response.output_item.added",
        output_index: 1,
        item: {
          type: "function_call",
          id: "fc_1",
          call_id: "call_b",
          name: "add",
          arguments: "",
          status: "in_progress",
        },
      },
      {
        type: "response.function_call_arguments.done",
        output_index: 1,
        call_id: "call_b",
        arguments: '{"a":3,"b":4}',
      },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            {
              type: "function_call",
              id: "fc_0",
              call_id: "call_a",
              name: "add",
              arguments: '{"a":1,"b":2}',
              status: "completed",
            },
            {
              type: "function_call",
              id: "fc_1",
              call_id: "call_b",
              name: "add",
              arguments: '{"a":3,"b":4}',
              status: "completed",
            },
          ],
        }),
      },
    ];

    // Iteration 2: final text answer
    const iter2Events: ORStreamEvent[] = [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "3 and 7" },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            {
              type: "message",
              id: "msg_001",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: "3 and 7" }],
            },
          ],
        }),
      },
    ];

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSSEResponse(iter1Events))
      .mockResolvedValueOnce(mockSSEResponse(iter2Events));

    const addTool = tool({
      name: "add",
      description: "Add two numbers",
      parameters: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
      execute: async ({ a, b }: { a: number; b: number }) => a + b,
    });

    const agent = makeAgent({ tools: [addTool] });
    const events = await collectEvents(agent.stream("Add 1+2 and 3+4"));

    // Two iteration_start events
    const iterStarts = events.filter((e) => e.type === "iteration_start");
    expect(iterStarts).toHaveLength(2);

    // Two tool_start / tool_end pairs
    const toolStarts = events.filter((e) => e.type === "tool_start");
    expect(toolStarts).toHaveLength(2);

    const toolEnds = events.filter((e) => e.type === "tool_end");
    expect(toolEnds).toHaveLength(2);

    // Final result
    const resultEvent = events.find((e) => e.type === "result");
    expect(resultEvent).toMatchObject({
      type: "result",
      output: "3 and 7",
      meta: { iterations: 2 },
    });
  });

  it("propagates server stream errors", async () => {
    const sseEvents: ORStreamEvent[] = [
      { type: "error", error: { code: "server_error", message: "Something went wrong" } },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent();
    const stream = agent.stream("fail");

    await expect(collectEvents(stream)).rejects.toThrow("Stream error: Something went wrong");
  });

  it("handles structured output with streaming", async () => {
    const completedResponse = makeCompletedResponse({
      output: [
        {
          type: "message",
          id: "msg_001",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: '{"name":"Alice","age":30}' }],
        },
      ],
    });

    const sseEvents: ORStreamEvent[] = [
      {
        type: "response.output_text.delta",
        output_index: 0,
        content_index: 0,
        delta: '{"name":"Alice"',
      },
      {
        type: "response.output_text.delta",
        output_index: 0,
        content_index: 0,
        delta: ',"age":30}',
      },
      { type: "response.completed", response: completedResponse },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent({
      outputSchema: {
        type: "object",
        properties: { name: { type: "string" }, age: { type: "number" } },
        required: ["name", "age"],
      },
    });

    const result = await agent.stream("Describe Alice").result();
    expect(result.output).toEqual({ name: "Alice", age: 30 });
  });

  it("handles tool errors in streaming gracefully", async () => {
    // Tool call
    const toolEvents: ORStreamEvent[] = [
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "function_call",
          id: "fc_0",
          call_id: "call_err",
          name: "failing_tool",
          arguments: "",
          status: "in_progress",
        },
      },
      {
        type: "response.function_call_arguments.done",
        output_index: 0,
        call_id: "call_err",
        arguments: "{}",
      },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            {
              type: "function_call",
              id: "fc_0",
              call_id: "call_err",
              name: "failing_tool",
              arguments: "{}",
              status: "completed",
            },
          ],
        }),
      },
    ];

    // Model recovers
    const recoveryEvents: ORStreamEvent[] = [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "Tool failed, sorry." },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            {
              type: "message",
              id: "msg_001",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: "Tool failed, sorry." }],
            },
          ],
        }),
      },
    ];

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSSEResponse(toolEvents))
      .mockResolvedValueOnce(mockSSEResponse(recoveryEvents));

    const failingTool = tool({
      name: "failing_tool",
      description: "A tool that always fails",
      execute: async () => {
        throw new Error("Boom!");
      },
    });

    const agent = makeAgent({ tools: [failingTool] });
    const events = await collectEvents(agent.stream("try it"));

    const toolEnd = events.find((e) => e.type === "tool_end");
    expect(toolEnd).toMatchObject({
      type: "tool_end",
      name: "failing_tool",
      error: "Boom!",
    });

    const result = events.find((e) => e.type === "result");
    expect(result).toMatchObject({
      type: "result",
      output: "Tool failed, sorry.",
    });
  });

  it("yields reasoning_delta events from SSE reasoning events", async () => {
    const completedResponse = makeCompletedResponse({
      output: [
        {
          type: "reasoning",
          id: "rs_001",
          summary: [{ type: "summary_text", text: "Let me think about this." }],
        },
        {
          type: "message",
          id: "msg_001",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Hello" }],
        },
      ],
    });

    const sseEvents: ORStreamEvent[] = [
      { type: "response.reasoning_summary_text.delta", output_index: 0, delta: "Let me think" },
      { type: "response.reasoning_summary_text.delta", output_index: 0, delta: " about this." },
      { type: "response.reasoning_summary_text.done", output_index: 0, text: "Let me think about this." },
      { type: "response.output_text.delta", output_index: 1, content_index: 0, delta: "Hello" },
      { type: "response.completed", response: completedResponse },
    ];

    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const agent = makeAgent();
    const events = await collectEvents(agent.stream("Hi"));

    const reasoningDeltas = events.filter((e) => e.type === "reasoning_delta");
    expect(reasoningDeltas).toHaveLength(2);
    expect(reasoningDeltas[0]).toEqual({ type: "reasoning_delta", text: "Let me think" });
    expect(reasoningDeltas[1]).toEqual({ type: "reasoning_delta", text: " about this." });

    const result = events.find((e) => e.type === "result") as { type: "result"; meta: { reasoning?: string[] } };
    expect(result.meta.reasoning).toEqual(["Let me think about this."]);
  });

  it("handles sequential tool execution in streaming", async () => {
    const toolEvents: ORStreamEvent[] = [
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "function_call",
          id: "fc_0",
          call_id: "call_1",
          name: "step",
          arguments: "",
          status: "in_progress",
        },
      },
      {
        type: "response.function_call_arguments.done",
        output_index: 0,
        call_id: "call_1",
        arguments: '{"n":1}',
      },
      {
        type: "response.output_item.added",
        output_index: 1,
        item: {
          type: "function_call",
          id: "fc_1",
          call_id: "call_2",
          name: "step",
          arguments: "",
          status: "in_progress",
        },
      },
      {
        type: "response.function_call_arguments.done",
        output_index: 1,
        call_id: "call_2",
        arguments: '{"n":2}',
      },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            { type: "function_call", id: "fc_0", call_id: "call_1", name: "step", arguments: '{"n":1}', status: "completed" },
            { type: "function_call", id: "fc_1", call_id: "call_2", name: "step", arguments: '{"n":2}', status: "completed" },
          ],
        }),
      },
    ];

    const textEvents: ORStreamEvent[] = [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "done" },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [{
            type: "message", id: "msg_001", role: "assistant", status: "completed",
            content: [{ type: "output_text", text: "done" }],
          }],
        }),
      },
    ];

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSSEResponse(toolEvents))
      .mockResolvedValueOnce(mockSSEResponse(textEvents));

    const order: number[] = [];
    const stepTool = tool({
      name: "step",
      description: "A step",
      parameters: { type: "object", properties: { n: { type: "number" } }, required: ["n"] },
      execute: async ({ n }: { n: number }) => {
        order.push(n);
        return n;
      },
    });

    const agent = makeAgent({ tools: [stepTool], parallelToolExecution: false });
    const events = await collectEvents(agent.stream("go"));

    // Sequential: tool_start/end for first, then tool_start/end for second
    const toolEvents2 = events.filter((e) => e.type === "tool_start" || e.type === "tool_end");
    expect(toolEvents2.map((e) => e.type)).toEqual([
      "tool_start", "tool_end", "tool_start", "tool_end",
    ]);

    // Execution was sequential
    expect(order).toEqual([1, 2]);
  });

  it("launches tools eagerly as function_call_arguments.done arrives", async () => {
    const executionTimestamps: { name: string; startedAt: number }[] = [];

    const sseEvents: ORStreamEvent[] = [
      { type: "response.created", response: makeCompletedResponse() },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { type: "function_call", id: "fc_0", call_id: "call_1", name: "fast_tool", arguments: "", status: "in_progress" },
      },
      { type: "response.function_call_arguments.done", output_index: 0, call_id: "call_1", arguments: '{"id":1}' },
      {
        type: "response.output_item.added",
        output_index: 1,
        item: { type: "function_call", id: "fc_1", call_id: "call_2", name: "fast_tool", arguments: "", status: "in_progress" },
      },
      { type: "response.function_call_arguments.done", output_index: 1, call_id: "call_2", arguments: '{"id":2}' },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [
            { type: "function_call", id: "fc_0", call_id: "call_1", name: "fast_tool", arguments: '{"id":1}', status: "completed" },
            { type: "function_call", id: "fc_1", call_id: "call_2", name: "fast_tool", arguments: '{"id":2}', status: "completed" },
          ],
        }),
      },
    ];

    const textEvents: ORStreamEvent[] = [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "Done" },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [{ type: "message", id: "msg_001", role: "assistant", status: "completed", content: [{ type: "output_text", text: "Done" }] }],
        }),
      },
    ];

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(mockSSEResponse(sseEvents))
      .mockResolvedValueOnce(mockSSEResponse(textEvents));

    const fastTool = tool({
      name: "fast_tool",
      description: "Fast tool",
      parameters: { type: "object", properties: { id: { type: "number" } } },
      execute: async ({ id }: { id: number }) => {
        executionTimestamps.push({ name: `tool_${id}`, startedAt: Date.now() });
        await new Promise((r) => setTimeout(r, 10));
        return { id, result: "ok" };
      },
    });

    const agent = makeAgent({ tools: [fastTool] });
    const events = await collectEvents(agent.stream("Go"));

    const toolEnds = events.filter((e) => e.type === "tool_end");
    expect(toolEnds).toHaveLength(2);

    expect(executionTimestamps).toHaveLength(2);
    const timeDiff = Math.abs(executionTimestamps[0].startedAt - executionTimestamps[1].startedAt);
    expect(timeDiff).toBeLessThan(50);

    const result = events.find((e) => e.type === "result");
    expect(result).toBeDefined();
  });

  it("injects turn warnings and recovers on bonus turn (streaming)", async () => {
    const makeToolCallSSE = (callId: string, name: string, args: string): ORStreamEvent[] => [
      { type: "response.created", response: makeCompletedResponse() },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "function_call",
          id: `fc_${callId}`,
          call_id: callId,
          name,
          arguments: "",
          status: "in_progress",
        },
      },
      { type: "response.function_call_arguments.done", output_index: 0, call_id: callId, arguments: args },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [{ type: "function_call", id: `fc_${callId}`, call_id: callId, name, arguments: args, status: "completed" }],
        }),
      },
    ];

    const makeTextSSE = (text: string): ORStreamEvent[] => [
      { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: text },
      {
        type: "response.completed",
        response: makeCompletedResponse({
          output: [{ type: "message", id: "msg_001", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }],
        }),
      },
    ];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockSSEResponse(makeToolCallSSE("c1", "work", "{}")))
      .mockResolvedValueOnce(mockSSEResponse(makeToolCallSSE("c2", "work", "{}")))
      .mockResolvedValueOnce(mockSSEResponse(makeToolCallSSE("c3", "work", "{}")))
      .mockResolvedValueOnce(mockSSEResponse(makeTextSSE("Recovered!")));
    globalThis.fetch = fetchMock;

    const workTool = tool({ name: "work", description: "Work", execute: async () => "ok" });
    const agent = makeAgent({ tools: [workTool], maxIterations: 3 });
    const events = await collectEvents(agent.stream("Go"));

    const result = events.find((e) => e.type === "result") as { type: "result"; output: unknown; meta: { iterations: number } };
    expect(result.output).toBe("Recovered!");
    expect(result.meta.iterations).toBe(4);

    // Verify the recovery turn request had the warning
    const fourthCallBody = JSON.parse(fetchMock.mock.calls[3][1].body);
    const fourthItems = fourthCallBody.input as Array<Record<string, unknown>>;
    const recoveryItem = fourthItems.find(
      (item: Record<string, unknown>) => item.type === "message" && item.role === "developer" && typeof item.content === "string" && (item.content as string).includes("Turn limit exceeded"),
    );
    expect(recoveryItem).toBeDefined();
  });
});
