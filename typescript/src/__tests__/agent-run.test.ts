import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, tool, MaxIterationsError, AbortError, AgentError } from "../agent/index.js";
import type { ORResponse, ORRequest } from "../agent/types.js";
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

/** Track fetch calls and return canned responses in sequence as SSE streams. */
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

describe("Agent.run()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -----------------------------------------------------------------------
  // Basic text response (no tools)
  // -----------------------------------------------------------------------

  it("returns text output for simple response", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("Hello there!")]);

    const agent = makeAgent();
    const result = await agent.run("Hi");

    expect(result.output).toBe("Hello there!");
    expect(result.meta.iterations).toBe(1);
    expect(result.meta.toolCalls).toHaveLength(0);
    expect(result.meta.usage.inputTokens).toBe(100);
    expect(result.meta.usage.outputTokens).toBe(50);
    expect(result.meta.responseId).toBe("resp_001");
  });

  it("sends correct request shape", async () => {
    const fetchMock = mockFetchSequence([textResponse("OK")]);
    globalThis.fetch = fetchMock;

    const agent = makeAgent({
      model: "anthropic/claude-sonnet-4-6",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "medium",
    });
    await agent.run("Hello");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.input).toEqual([{ type: "message", role: "user", content: "Hello" }]);
    expect(body.instructions).toBe("You are a helpful assistant.");
    expect(body.model).toBe("anthropic/claude-sonnet-4-6");
    expect(body.temperature).toBe(0.7);
    expect(body.max_output_tokens).toBe(4096);
    expect(body.reasoning).toEqual({ effort: "medium" });
    expect(body.stream).toBe(true);
  });

  it("sends tools in request when agent has tools", async () => {
    const fetchMock = mockFetchSequence([textResponse("OK")]);
    globalThis.fetch = fetchMock;

    const getWeather = tool({
      name: "get_weather",
      description: "Get weather",
      parameters: { type: "object", properties: { city: { type: "string" } } },
      execute: async () => ({}),
    });

    const agent = makeAgent({ tools: [getWeather] });
    await agent.run("Hello");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.tools).toHaveLength(1);
    expect(body.tools![0]).toEqual({
      type: "function",
      name: "get_weather",
      description: "Get weather",
      parameters: { type: "object", properties: { city: { type: "string" } } },
    });
  });

  // -----------------------------------------------------------------------
  // Single tool call round-trip
  // -----------------------------------------------------------------------

  it("executes tool and returns final response", async () => {
    const fetchMock = mockFetchSequence([
      // First call: model returns a tool call
      toolCallResponse([
        { call_id: "call_abc", name: "get_metric", arguments: '{"metric":"dau"}' },
      ]),
      // Second call: model returns text after seeing tool result
      textResponse("Your DAU is 1,234.", { id: "resp_002" }),
    ]);
    globalThis.fetch = fetchMock;

    const getMetric = tool({
      name: "get_metric",
      description: "Get a metric",
      parameters: { type: "object", properties: { metric: { type: "string" } } },
      execute: async ({ metric }: { metric: string }) => ({ metric, value: 1234 }),
    });

    const agent = makeAgent({ tools: [getMetric] });
    const result = await agent.run("What is our DAU?");

    expect(result.output).toBe("Your DAU is 1,234.");
    expect(result.meta.iterations).toBe(2);
    expect(result.meta.toolCalls).toHaveLength(1);
    expect(result.meta.toolCalls[0].name).toBe("get_metric");
    expect(result.meta.toolCalls[0].input).toEqual({ metric: "dau" });
    expect(result.meta.toolCalls[0].output).toEqual({ metric: "dau", value: 1234 });
    expect(result.meta.toolCalls[0].error).toBeUndefined();
    expect(result.meta.responseId).toBe("resp_002");
  });

  it("sends tool result as function_call_output item", async () => {
    const fetchMock = mockFetchSequence([
      toolCallResponse([
        { call_id: "call_abc", name: "add", arguments: '{"a":2,"b":3}' },
      ]),
      textResponse("5"),
    ]);
    globalThis.fetch = fetchMock;

    const addTool = tool({
      name: "add",
      description: "Add numbers",
      execute: async ({ a, b }: { a: number; b: number }) => ({ sum: a + b }),
    });

    const agent = makeAgent({ tools: [addTool] });
    await agent.run("Add 2 and 3");

    // Check the second call includes function_call_output
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body) as ORRequest;
    const items = secondBody.input as Array<Record<string, unknown>>;

    // Should have: user message, function_call, function_call_output
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ type: "message", role: "user", content: "Add 2 and 3" });
    expect(items[1]).toMatchObject({ type: "function_call", call_id: "call_abc", name: "add" });
    expect(items[2]).toEqual({
      type: "function_call_output",
      call_id: "call_abc",
      output: '{"sum":5}',
    });
  });

  // -----------------------------------------------------------------------
  // Multiple tool calls (parallel)
  // -----------------------------------------------------------------------

  it("executes multiple tool calls in parallel", async () => {
    const fetchMock = mockFetchSequence([
      toolCallResponse([
        { call_id: "call_1", name: "get_metric", arguments: '{"metric":"dau"}' },
        { call_id: "call_2", name: "get_metric", arguments: '{"metric":"mau"}' },
      ]),
      textResponse("DAU: 1000, MAU: 5000"),
    ]);
    globalThis.fetch = fetchMock;

    const executionOrder: string[] = [];
    const getMetric = tool({
      name: "get_metric",
      description: "Get a metric",
      execute: async ({ metric }: { metric: string }) => {
        executionOrder.push(metric);
        return { metric, value: metric === "dau" ? 1000 : 5000 };
      },
    });

    const agent = makeAgent({ tools: [getMetric] });
    const result = await agent.run("Get DAU and MAU");

    expect(result.meta.toolCalls).toHaveLength(2);
    expect(result.meta.toolCalls[0].callId).toBe("call_1");
    expect(result.meta.toolCalls[1].callId).toBe("call_2");
    expect(result.output).toBe("DAU: 1000, MAU: 5000");
  });

  // -----------------------------------------------------------------------
  // Multi-iteration
  // -----------------------------------------------------------------------

  it("handles multiple iterations of tool calls", async () => {
    const fetchMock = mockFetchSequence([
      // Iteration 1: first tool call
      toolCallResponse([
        { call_id: "call_1", name: "step1", arguments: '{}' },
      ]),
      // Iteration 2: second tool call
      toolCallResponse([
        { call_id: "call_2", name: "step2", arguments: '{}' },
      ]),
      // Iteration 3: final response
      textResponse("Done!"),
    ]);
    globalThis.fetch = fetchMock;

    const step1 = tool({ name: "step1", description: "Step 1", execute: async () => "result1" });
    const step2 = tool({ name: "step2", description: "Step 2", execute: async () => "result2" });

    const agent = makeAgent({ tools: [step1, step2] });
    const result = await agent.run("Do the steps");

    expect(result.meta.iterations).toBe(3);
    expect(result.meta.toolCalls).toHaveLength(2);
    expect(result.meta.toolCalls[0].name).toBe("step1");
    expect(result.meta.toolCalls[1].name).toBe("step2");
    expect(result.output).toBe("Done!");
  });

  // -----------------------------------------------------------------------
  // MaxIterations error
  // -----------------------------------------------------------------------

  it("throws MaxIterationsError when limit reached", async () => {
    // Always return tool calls, never a final response
    const fetchMock = mockFetchSequence([
      toolCallResponse([{ call_id: "call_1", name: "loop", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_2", name: "loop", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_3", name: "loop", arguments: "{}" }]),
    ]);
    globalThis.fetch = fetchMock;

    const loopTool = tool({ name: "loop", description: "Loop", execute: async () => "looping" });
    const agent = makeAgent({ tools: [loopTool], maxIterations: 3 });

    try {
      await agent.run("Go");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MaxIterationsError);
      const maxErr = err as MaxIterationsError;
      expect(maxErr.iterations).toBe(3);
      // 4 tool calls: 3 regular + 1 recovery turn (mock reuses last response)
      expect(maxErr.toolCalls).toHaveLength(4);
    }
  });

  // -----------------------------------------------------------------------
  // Tool error handling
  // -----------------------------------------------------------------------

  it("sends tool errors back to the model", async () => {
    const fetchMock = mockFetchSequence([
      toolCallResponse([
        { call_id: "call_1", name: "failing", arguments: "{}" },
      ]),
      textResponse("I see the tool failed. Let me try another way."),
    ]);
    globalThis.fetch = fetchMock;

    const failingTool = tool({
      name: "failing",
      description: "Always fails",
      execute: async () => {
        throw new Error("Database connection lost");
      },
    });

    const agent = makeAgent({ tools: [failingTool] });
    const result = await agent.run("Try this");

    // Tool error is recorded
    expect(result.meta.toolCalls[0].error).toBe("Database connection lost");
    expect(result.meta.toolCalls[0].output).toBeUndefined();

    // Error was sent back as function_call_output
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body) as ORRequest;
    const items = secondBody.input as Array<Record<string, unknown>>;
    const outputItem = items.find((i) => i.type === "function_call_output") as Record<string, unknown>;
    expect(outputItem.output).toBe('{"error":"Database connection lost"}');
  });

  it("handles unknown tool name gracefully", async () => {
    const fetchMock = mockFetchSequence([
      toolCallResponse([
        { call_id: "call_1", name: "nonexistent", arguments: "{}" },
      ]),
      textResponse("OK"),
    ]);
    globalThis.fetch = fetchMock;

    const agent = makeAgent();
    const result = await agent.run("Try this");

    expect(result.meta.toolCalls[0].error).toBe('Tool "nonexistent" not found');
  });

  // -----------------------------------------------------------------------
  // Structured output
  // -----------------------------------------------------------------------

  it("parses structured JSON output when outputSchema is set", async () => {
    globalThis.fetch = mockFetchSequence([
      textResponse('{"summary":"Good metrics","score":8.5}'),
    ]);

    const agent = makeAgent({
      outputSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          score: { type: "number" },
        },
      },
    });

    const result = await agent.run("Analyze");
    expect(result.output).toEqual({ summary: "Good metrics", score: 8.5 });
  });

  it("sends text.format when outputSchema is set", async () => {
    const fetchMock = mockFetchSequence([textResponse('{"x":1}')]);
    globalThis.fetch = fetchMock;

    const schema = { type: "object", properties: { x: { type: "number" } } };
    const agent = makeAgent({ outputSchema: schema });
    await agent.run("Test");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.text).toEqual({
      format: { type: "json_schema", name: "output", schema },
    });
  });

  // -----------------------------------------------------------------------
  // Per-run option overrides
  // -----------------------------------------------------------------------

  it("applies per-run option overrides", async () => {
    const fetchMock = mockFetchSequence([textResponse("OK")]);
    globalThis.fetch = fetchMock;

    const agent = makeAgent({ model: "default-model", temperature: 0.5 });
    await agent.run("Test", {
      model: "override-model",
      temperature: 0.9,
      maxIterations: 5,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.model).toBe("override-model");
    expect(body.temperature).toBe(0.9);
  });

  // -----------------------------------------------------------------------
  // Usage aggregation
  // -----------------------------------------------------------------------

  it("aggregates usage across iterations", async () => {
    globalThis.fetch = mockFetchSequence([
      toolCallResponse(
        [{ call_id: "c1", name: "t", arguments: "{}" }],
        { usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } },
      ),
      textResponse("Done", {
        usage: { input_tokens: 200, output_tokens: 30, total_tokens: 230 },
      }),
    ]);

    const t = tool({ name: "t", description: "t", execute: async () => "ok" });
    const agent = makeAgent({ tools: [t] });
    const result = await agent.run("Go");

    expect(result.meta.usage.inputTokens).toBe(300);
    expect(result.meta.usage.outputTokens).toBe(50);
    expect(result.meta.usage.totalTokens).toBe(350);
  });

  // -----------------------------------------------------------------------
  // Abort signal
  // -----------------------------------------------------------------------

  it("throws AbortError when signal is already aborted", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("OK")]);

    const controller = new AbortController();
    controller.abort();

    const agent = makeAgent();
    await expect(agent.run("Hi", { signal: controller.signal })).rejects.toThrow(AbortError);
  });

  // -----------------------------------------------------------------------
  // Server error handling
  // -----------------------------------------------------------------------

  it("throws AgentError on server error in response", async () => {
    globalThis.fetch = mockFetchSequence([
      makeORResponse({
        status: "failed",
        error: { code: "server_error", message: "Internal failure", type: "server_error" },
      }),
    ]);

    const agent = makeAgent();
    await expect(agent.run("Hi")).rejects.toThrow(AgentError);
  });

  // -----------------------------------------------------------------------
  // Items input (for conversation)
  // -----------------------------------------------------------------------

  it("accepts items array as input", async () => {
    const fetchMock = mockFetchSequence([textResponse("Your name is Alice")]);
    globalThis.fetch = fetchMock;

    const agent = makeAgent();
    const result = await agent.run([
      { type: "message", role: "user", content: "My name is Alice" },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.input).toEqual([{ type: "message", role: "user", content: "My name is Alice" }]);
    expect(result.output).toBe("Your name is Alice");
  });

  // -----------------------------------------------------------------------
  // Constructor validation
  // -----------------------------------------------------------------------

  it("throws when no API key is provided", () => {
    const originalEnv = process.env.OPPER_API_KEY;
    delete process.env.OPPER_API_KEY;

    try {
      expect(() => new Agent({ name: "test", instructions: "test" })).toThrow("Missing API key");
    } finally {
      if (originalEnv) process.env.OPPER_API_KEY = originalEnv;
    }
  });

  // -----------------------------------------------------------------------
  // Reasoning in meta
  // -----------------------------------------------------------------------

  it("includes reasoning in meta when response has reasoning items", async () => {
    const fetchMock = mockFetchSequence([
      // Iteration 1: tool call with reasoning
      makeORResponse({
        output: [
          {
            type: "reasoning",
            id: "rs_001",
            summary: [{ type: "summary_text", text: "I should search for this." }],
          },
          {
            type: "function_call",
            id: "fc_0",
            call_id: "call_1",
            name: "search",
            arguments: '{"q":"test"}',
            status: "completed",
          },
        ],
      }),
      // Iteration 2: text response with reasoning
      makeORResponse({
        output: [
          {
            type: "reasoning",
            id: "rs_002",
            summary: [{ type: "summary_text", text: "The search returned good results." }],
          },
          {
            type: "message",
            id: "msg_001",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "Found it!" }],
          },
        ],
      }),
    ]);
    globalThis.fetch = fetchMock;

    const searchTool = tool({
      name: "search",
      description: "Search",
      execute: async () => ({ results: ["r1"] }),
    });

    const agent = makeAgent({ tools: [searchTool] });
    const result = await agent.run("Find test");

    expect(result.meta.reasoning).toEqual([
      "I should search for this.",
      "The search returned good results.",
    ]);
  });

  it("omits reasoning from meta when no reasoning items present", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("Hello")]);

    const agent = makeAgent();
    const result = await agent.run("Hi");

    expect(result.meta.reasoning).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Turn awareness
  // -----------------------------------------------------------------------

  it("injects warning messages near max iterations", async () => {
    const fetchMock = mockFetchSequence([
      toolCallResponse([{ call_id: "call_1", name: "work", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_2", name: "work", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_3", name: "work", arguments: "{}" }]),
      textResponse("Done!"),
    ]);
    globalThis.fetch = fetchMock;

    const workTool = tool({ name: "work", description: "Work", execute: async () => "ok" });
    const agent = makeAgent({ tools: [workTool], maxIterations: 5 });
    const result = await agent.run("Go");

    expect(result.output).toBe("Done!");
    expect(result.meta.iterations).toBe(4);

    // Check iteration 3 (maxIterations - 2 = 3) has warning injected
    const thirdCallBody = JSON.parse(fetchMock.mock.calls[2][1].body) as ORRequest;
    const thirdItems = thirdCallBody.input as Array<Record<string, unknown>>;
    const warningItem = thirdItems.find(
      (item) => item.type === "message" && item.role === "developer" && typeof item.content === "string" && (item.content as string).includes("2 turns remaining"),
    );
    expect(warningItem).toBeDefined();
  });

  it("recovers on bonus turn when model calls tools on final iteration", async () => {
    const fetchMock = mockFetchSequence([
      toolCallResponse([{ call_id: "call_1", name: "work", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_2", name: "work", arguments: "{}" }]),
      // Iteration 3 (maxIterations): still calls tools
      toolCallResponse([{ call_id: "call_3", name: "work", arguments: "{}" }]),
      // Recovery turn (iteration 4): finally produces output
      textResponse("Recovered!"),
    ]);
    globalThis.fetch = fetchMock;

    const workTool = tool({ name: "work", description: "Work", execute: async () => "ok" });
    const agent = makeAgent({ tools: [workTool], maxIterations: 3 });
    const result = await agent.run("Go");

    expect(result.output).toBe("Recovered!");
    expect(result.meta.iterations).toBe(4);

    // Check recovery turn had the "Turn limit exceeded" message
    const fourthCallBody = JSON.parse(fetchMock.mock.calls[3][1].body) as ORRequest;
    const fourthItems = fourthCallBody.input as Array<Record<string, unknown>>;
    const recoveryItem = fourthItems.find(
      (item) => item.type === "message" && item.role === "developer" && typeof item.content === "string" && (item.content as string).includes("Turn limit exceeded"),
    );
    expect(recoveryItem).toBeDefined();
  });

  it("throws MaxIterationsError when recovery turn also calls tools", async () => {
    const fetchMock = mockFetchSequence([
      toolCallResponse([{ call_id: "call_1", name: "work", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_2", name: "work", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_3", name: "work", arguments: "{}" }]),
      toolCallResponse([{ call_id: "call_4", name: "work", arguments: "{}" }]),
    ]);
    globalThis.fetch = fetchMock;

    const workTool = tool({ name: "work", description: "Work", execute: async () => "ok" });
    const agent = makeAgent({ tools: [workTool], maxIterations: 3 });

    await expect(agent.run("Go")).rejects.toThrow(MaxIterationsError);
  });
});
