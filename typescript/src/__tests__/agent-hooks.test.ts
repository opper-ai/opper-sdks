import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, tool } from "../agent/index.js";
import type { Hooks, ORResponse } from "../agent/types.js";

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
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-length": "100" }),
      json: () => Promise.resolve(resp),
      text: () => Promise.resolve(JSON.stringify(resp)),
    };
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

/** Create a hooks object where every hook records its call to `log`. */
function trackingHooks(log: string[]): Hooks {
  return {
    onAgentStart: async (ctx) => { log.push(`agentStart:${ctx.agent}`); },
    onAgentEnd: async (ctx) => { log.push(`agentEnd:${ctx.result ? "ok" : "err"}`); },
    onIterationStart: async (ctx) => { log.push(`iterStart:${ctx.iteration}`); },
    onIterationEnd: async (ctx) => { log.push(`iterEnd:${ctx.iteration}`); },
    onLLMCall: async (ctx) => { log.push(`llmCall:${ctx.iteration}`); },
    onLLMResponse: async (ctx) => { log.push(`llmResp:${ctx.iteration}`); },
    onToolStart: async (ctx) => { log.push(`toolStart:${ctx.name}`); },
    onToolEnd: async (ctx) => { log.push(`toolEnd:${ctx.name}`); },
  };
}

const greetTool = tool({
  name: "greet",
  description: "Greet someone",
  parameters: {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  },
  execute: async ({ name }: { name: string }) => `Hello, ${name}!`,
});

// ---------------------------------------------------------------------------
// Tests — run() (non-streaming)
// ---------------------------------------------------------------------------

describe("Agent hooks — run()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fires hooks in correct order for a simple run (no tools)", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("Hello!")]);

    const log: string[] = [];
    const agent = makeAgent({ hooks: trackingHooks(log) });
    await agent.run("Hi");

    expect(log).toEqual([
      "agentStart:test-agent",
      "iterStart:1",
      "llmCall:1",
      "llmResp:1",
      "iterEnd:1",
      "agentEnd:ok",
    ]);
  });

  it("fires tool hooks around tool execution", async () => {
    globalThis.fetch = mockFetchSequence([
      toolCallResponse([
        { call_id: "c1", name: "greet", arguments: '{"name":"World"}' },
      ]),
      textResponse("Done"),
    ]);

    const log: string[] = [];
    const agent = makeAgent({ tools: [greetTool], hooks: trackingHooks(log) });
    await agent.run("Greet the world");

    expect(log).toEqual([
      "agentStart:test-agent",
      // iteration 1: tool call
      "iterStart:1",
      "llmCall:1",
      "llmResp:1",
      "toolStart:greet",
      "toolEnd:greet",
      "iterEnd:1",
      // iteration 2: final response
      "iterStart:2",
      "llmCall:2",
      "llmResp:2",
      "iterEnd:2",
      "agentEnd:ok",
    ]);
  });

  it("fires onAgentEnd with error on MaxIterationsError", async () => {
    globalThis.fetch = mockFetchSequence([
      toolCallResponse([{ call_id: "c1", name: "greet", arguments: '{"name":"A"}' }]),
    ]);

    const log: string[] = [];
    const agent = makeAgent({
      tools: [greetTool],
      maxIterations: 1,
      hooks: trackingHooks(log),
    });

    await expect(agent.run("Go")).rejects.toThrow();

    expect(log).toContain("agentEnd:err");
    expect(log.indexOf("agentEnd:err")).toBe(log.length - 1);
  });

  it("provides correct context data to hooks", async () => {
    globalThis.fetch = mockFetchSequence([
      toolCallResponse([
        { call_id: "c1", name: "greet", arguments: '{"name":"Alice"}' },
      ]),
      textResponse("Done"),
    ]);

    const contexts: Record<string, unknown[]> = {};
    const hooks: Hooks = {
      onAgentStart: async (ctx) => {
        contexts.agentStart = [ctx.agent, ctx.input];
      },
      onLLMCall: async (ctx) => {
        // Only capture the first call (iteration 1 has the tool call)
        if (!contexts.llmCall) contexts.llmCall = [ctx.iteration, typeof ctx.request];
      },
      onLLMResponse: async (ctx) => {
        if (!contexts.llmResponse) contexts.llmResponse = [ctx.iteration, ctx.response.id];
      },
      onToolStart: async (ctx) => {
        contexts.toolStart = [ctx.name, ctx.callId, ctx.input, ctx.iteration];
      },
      onToolEnd: async (ctx) => {
        contexts.toolEnd = [ctx.name, ctx.callId, ctx.output, ctx.durationMs >= 0];
      },
      onAgentEnd: async (ctx) => {
        contexts.agentEnd = [!!ctx.result, ctx.error];
      },
    };

    const agent = makeAgent({ tools: [greetTool], hooks });
    await agent.run("Hello");

    expect(contexts.agentStart).toEqual(["test-agent", "Hello"]);
    expect(contexts.llmCall?.[0]).toBe(1);
    expect(contexts.llmCall?.[1]).toBe("object");
    expect(contexts.llmResponse?.[0]).toBe(1);
    expect(contexts.llmResponse?.[1]).toBe("resp_001");
    expect(contexts.toolStart).toEqual(["greet", "c1", { name: "Alice" }, 1]);
    expect(contexts.toolEnd?.[0]).toBe("greet");
    expect(contexts.toolEnd?.[1]).toBe("c1");
    expect(contexts.toolEnd?.[2]).toBe("Hello, Alice!");
    expect(contexts.toolEnd?.[3]).toBe(true);
    expect(contexts.agentEnd).toEqual([true, undefined]);
  });

  it("swallows hook errors without crashing the loop", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("Hello!")]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const hooks: Hooks = {
      onAgentStart: async () => { throw new Error("boom"); },
      onLLMCall: async () => { throw new Error("kaboom"); },
    };

    const agent = makeAgent({ hooks });
    const result = await agent.run("Hi");

    expect(result.output).toBe("Hello!");
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("onAgentStart");
    expect(warnSpy.mock.calls[1]?.[0]).toContain("onLLMCall");
  });

  it("supports synchronous hooks", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("Hello!")]);

    const log: string[] = [];
    const hooks: Hooks = {
      onAgentStart: (ctx) => { log.push(`sync:${ctx.agent}`); },
      onAgentEnd: (ctx) => { log.push("sync:end"); },
    };

    const agent = makeAgent({ hooks });
    await agent.run("Hi");

    expect(log).toEqual(["sync:test-agent", "sync:end"]);
  });

  it("works fine with no hooks configured", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("Hello!")]);

    const agent = makeAgent();
    const result = await agent.run("Hi");

    expect(result.output).toBe("Hello!");
  });

  it("works fine with partial hooks (only some defined)", async () => {
    globalThis.fetch = mockFetchSequence([textResponse("Hello!")]);

    const log: string[] = [];
    const hooks: Hooks = {
      onAgentStart: async (ctx) => { log.push("start"); },
      // no other hooks
    };

    const agent = makeAgent({ hooks });
    const result = await agent.run("Hi");

    expect(result.output).toBe("Hello!");
    expect(log).toEqual(["start"]);
  });
});

// ---------------------------------------------------------------------------
// Tests — stream() (streaming)
// ---------------------------------------------------------------------------

describe("Agent hooks — stream()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** Build an SSE text body from lines. */
  function sseBody(lines: string[]): ReadableStream<Uint8Array> {
    const text = lines.join("\n") + "\n";
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  }

  function mockStreamFetch(sseLines: string[]) {
    return vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: sseBody(sseLines),
    }));
  }

  function simpleTextSSE(text: string, responseId = "resp_s1"): string[] {
    const response: ORResponse = {
      id: responseId,
      object: "response",
      status: "completed",
      created_at: 1700000000,
      model: "test",
      output: [
        {
          type: "message",
          id: "msg_001",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    };

    return [
      `event: response.output_text.delta`,
      `data: ${JSON.stringify({ type: "response.output_text.delta", output_index: 0, content_index: 0, delta: text })}`,
      "",
      `event: response.completed`,
      `data: ${JSON.stringify({ type: "response.completed", response })}`,
      "",
    ];
  }

  it("fires hooks in correct order for streaming (no tools)", async () => {
    globalThis.fetch = mockStreamFetch(simpleTextSSE("Hi there"));

    const log: string[] = [];
    const agent = makeAgent({ hooks: trackingHooks(log) });
    const stream = agent.stream("Hello");

    // Consume all events
    for await (const _event of stream) { /* drain */ }

    expect(log).toEqual([
      "agentStart:test-agent",
      "iterStart:1",
      "llmCall:1",
      "llmResp:1",
      "iterEnd:1",
      "agentEnd:ok",
    ]);
  });

  it("fires tool hooks in streaming mode", async () => {
    // First call: tool call via SSE
    const toolCallResp: ORResponse = makeORResponse({
      output: [
        {
          type: "function_call",
          id: "fc_0",
          call_id: "c1",
          name: "greet",
          arguments: '{"name":"Bob"}',
          status: "completed",
        },
      ],
    });

    const toolCallSSE = [
      `event: response.output_item.added`,
      `data: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { type: "function_call", call_id: "c1", name: "greet", arguments: "" } })}`,
      "",
      `event: response.function_call_arguments.done`,
      `data: ${JSON.stringify({ type: "response.function_call_arguments.done", output_index: 0, call_id: "c1", arguments: '{"name":"Bob"}' })}`,
      "",
      `event: response.completed`,
      `data: ${JSON.stringify({ type: "response.completed", response: toolCallResp })}`,
      "",
    ];

    // Second call: text response via SSE
    const textSSE = simpleTextSSE("Hello, Bob!");

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      const lines = callCount++ === 0 ? toolCallSSE : textSSE;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: sseBody(lines),
      };
    });

    const log: string[] = [];
    const agent = makeAgent({ tools: [greetTool], hooks: trackingHooks(log) });
    const stream = agent.stream("Greet Bob");

    for await (const _event of stream) { /* drain */ }

    expect(log).toEqual([
      "agentStart:test-agent",
      // iteration 1: tool call (eager execution — tools fire before llmResp)
      "iterStart:1",
      "llmCall:1",
      "toolStart:greet",
      "toolEnd:greet",
      "llmResp:1",
      "iterEnd:1",
      // iteration 2: final text
      "iterStart:2",
      "llmCall:2",
      "llmResp:2",
      "iterEnd:2",
      "agentEnd:ok",
    ]);
  });

  it("swallows hook errors in streaming mode", async () => {
    globalThis.fetch = mockStreamFetch(simpleTextSSE("Hi"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const hooks: Hooks = {
      onIterationStart: async () => { throw new Error("boom"); },
    };

    const agent = makeAgent({ hooks });
    const stream = agent.stream("Hello");

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
