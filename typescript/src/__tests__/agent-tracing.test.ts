import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, Opper, mergeHooks, tool } from "../index.js";
import type { Hooks, ORResponse } from "../agent/types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Captured fetch call. */
interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

let fetchCalls: FetchCall[];

function makeORResponse(text: string, overrides: Partial<ORResponse> = {}): ORResponse {
  return {
    id: "resp_001",
    object: "response",
    status: "completed",
    created_at: 1700000000,
    model: "test-model",
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
    ...overrides,
  };
}

function toolCallResponse(
  calls: Array<{ call_id: string; name: string; arguments: string }>,
): ORResponse {
  return {
    id: "resp_002",
    object: "response",
    status: "completed",
    created_at: 1700000000,
    model: "test-model",
    output: calls.map((call, i) => ({
      type: "function_call" as const,
      id: `fc_${i}`,
      call_id: call.call_id,
      name: call.name,
      arguments: call.arguments,
      status: "completed",
    })),
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  };
}

function spanResponse(id: string, traceId: string) {
  return { data: { id, trace_id: traceId, name: "test" } };
}

/**
 * Create a mock fetch that routes requests based on URL pattern.
 * Tracks all calls for inspection.
 */
function createMockFetch(
  orResponses: ORResponse[],
  spanId = "span-001",
  traceId = "trace-001",
) {
  let orCallIndex = 0;
  let toolSpanCounter = 0;

  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const headers = Object.fromEntries(
      Object.entries(init?.headers ?? {}).map(([k, v]) => [k, String(v)]),
    );
    const body = init?.body ? JSON.parse(init.body as string) : undefined;

    fetchCalls.push({ url, method: init?.method ?? "GET", headers, body });

    // Route by URL
    if (url.includes("/v3/spans") && init?.method === "POST") {
      toolSpanCounter++;
      const toolSpanId = `tool-span-${toolSpanCounter}`;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: async () => spanResponse(toolSpanId, traceId),
        text: async () => JSON.stringify(spanResponse(toolSpanId, traceId)),
      };
    }

    if (url.includes("/v3/spans") && init?.method === "PATCH") {
      return {
        ok: true,
        status: 204,
        statusText: "No Content",
        headers: new Headers({ "content-length": "0" }),
        json: async () => ({}),
        text: async () => "",
      };
    }

    if (url.includes("/v3/compat/openresponses")) {
      const resp = orResponses[orCallIndex++] ?? orResponses[orResponses.length - 1];
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: async () => resp,
        text: async () => JSON.stringify(resp),
      };
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });
}

function spanCalls() {
  return fetchCalls.filter((c) => c.url.includes("/v3/spans"));
}

function spanCreates() {
  return spanCalls().filter((c) => c.method === "POST");
}

function spanUpdates() {
  return spanCalls().filter((c) => c.method === "PATCH");
}

function orCalls() {
  return fetchCalls.filter((c) => c.url.includes("/v3/compat/openresponses"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent Tracing", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("Agent with tracing (default)", () => {
    it("creates a parent span on run and closes it on completion", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("Hello!")]);

      const agent = new Agent({
        name: "test-agent",
        instructions: "Be helpful.",
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      const result = await agent.run("Hi");
      expect(result.output).toBe("Hello!");

      // Should have: 1 span create (agent), 1 OR call, 1 span update (close agent)
      const creates = spanCreates();
      expect(creates).toHaveLength(1);
      expect(creates[0].body.name).toBe("test-agent");
      expect(creates[0].body.input).toBe("Hi");
      expect(creates[0].body.start_time).toBeDefined();

      const updates = spanUpdates();
      expect(updates).toHaveLength(1);
      expect(updates[0].body.end_time).toBeDefined();
      expect(updates[0].body.output).toBe("Hello!");
    });

    it("sends X-Opper-Parent-Span-Id header on LLM calls", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("Hello!")]);

      const agent = new Agent({
        name: "my-agent",
        instructions: "Test.",
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      await agent.run("Hi");

      const llmCalls = orCalls();
      expect(llmCalls).toHaveLength(1);
      expect(llmCalls[0].headers["X-Opper-Parent-Span-Id"]).toMatch(/tool-span-1/);
      expect(llmCalls[0].headers["X-Opper-Name"]).toBe("my-agent");
    });

    it("creates tool child spans on tool calls", async () => {
      const greet = tool({
        name: "greet",
        description: "Greet someone",
        parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
        execute: async (params: unknown) => {
          const { name } = params as { name: string };
          return `Hello, ${name}!`;
        },
      });

      globalThis.fetch = createMockFetch([
        toolCallResponse([{ call_id: "c1", name: "greet", arguments: '{"name":"Alice"}' }]),
        makeORResponse("Greeted Alice!"),
      ]);

      const agent = new Agent({
        name: "greeter",
        instructions: "Greet.",
        tools: [greet],
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      await agent.run("Greet Alice");

      // Span creates: 1 agent + 1 tool
      const creates = spanCreates();
      expect(creates).toHaveLength(2);
      expect(creates[0].body.name).toBe("greeter");

      const toolCreate = creates[1];
      expect(toolCreate.body.name).toBe("greet");
      expect(toolCreate.body.parent_id).toBeDefined();
      expect(toolCreate.body.trace_id).toBe("trace-001");

      // Span updates: 1 tool close + 1 agent close
      const updates = spanUpdates();
      expect(updates).toHaveLength(2);
    });

    it("records error on span when run fails", async () => {
      // Make the OR call fail
      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        fetchCalls.push({
          url,
          method: init?.method ?? "GET",
          headers: Object.fromEntries(
            Object.entries(init?.headers ?? {}).map(([k, v]) => [k, String(v)]),
          ),
          body,
        });

        if (url.includes("/v3/spans") && init?.method === "POST") {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            headers: new Headers({ "content-length": "100" }),
            json: async () => spanResponse("span-err", "trace-err"),
            text: async () => JSON.stringify(spanResponse("span-err", "trace-err")),
          };
        }
        if (url.includes("/v3/spans") && init?.method === "PATCH") {
          return {
            ok: true,
            status: 204,
            statusText: "No Content",
            headers: new Headers({ "content-length": "0" }),
            json: async () => ({}),
            text: async () => "",
          };
        }
        if (url.includes("/v3/compat/openresponses")) {
          return {
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            headers: new Headers(),
            json: async () => ({ error: "boom" }),
            text: async () => '{"error":"boom"}',
          };
        }
        throw new Error(`Unexpected: ${url}`);
      });

      const agent = new Agent({
        name: "fail-agent",
        instructions: "Fail.",
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      await expect(agent.run("Hi")).rejects.toThrow();

      // Span should be updated with error
      const updates = spanUpdates();
      expect(updates).toHaveLength(1);
      expect(updates[0].body.error).toBeDefined();
      expect(updates[0].body.end_time).toBeDefined();
    });

    it("composes user hooks with tracing hooks", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("Hello!")]);

      const events: string[] = [];
      const userHooks: Hooks = {
        onAgentStart: () => { events.push("user:start"); },
        onAgentEnd: () => { events.push("user:end"); },
      };

      const agent = new Agent({
        name: "hooked",
        instructions: "Test.",
        hooks: userHooks,
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      await agent.run("Hi");

      // User hooks should have fired
      expect(events).toContain("user:start");
      expect(events).toContain("user:end");

      // Tracing should also have worked
      expect(spanCreates()).toHaveLength(1);
      expect(spanUpdates()).toHaveLength(1);
    });
  });

  describe("Agent with tracing: false", () => {
    it("does not create spans when tracing is disabled", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("Hello!")]);

      const agent = new Agent({
        name: "plain",
        instructions: "Test.",
        tracing: false,
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      await agent.run("Hi");

      // Only the OR call, no span calls
      expect(spanCalls()).toHaveLength(0);
      expect(orCalls()).toHaveLength(1);

      // No tracing headers
      expect(orCalls()[0].headers["X-Opper-Parent-Span-Id"]).toBeUndefined();
    });
  });

  describe("mergeHooks()", () => {
    it("returns undefined when both are undefined", () => {
      expect(mergeHooks(undefined, undefined)).toBeUndefined();
    });

    it("returns the other when one is undefined", () => {
      const hooks: Hooks = { onAgentStart: () => {} };
      expect(mergeHooks(hooks, undefined)).toBe(hooks);
      expect(mergeHooks(undefined, hooks)).toBe(hooks);
    });

    it("merges hooks so both fire in order", async () => {
      const order: string[] = [];
      const a: Hooks = {
        onAgentStart: () => { order.push("a"); },
        onToolStart: () => { order.push("a-tool"); },
      };
      const b: Hooks = {
        onAgentStart: () => { order.push("b"); },
        onAgentEnd: () => { order.push("b-end"); },
      };

      const merged = mergeHooks(a, b)!;
      expect(merged).toBeDefined();

      // Both onAgentStart hooks fire, a first
      await merged.onAgentStart!({ agent: "test", input: "" } as never);
      expect(order).toEqual(["a", "b"]);

      // Only a has onToolStart
      await merged.onToolStart!({ agent: "test", iteration: 1, name: "t", callId: "c", input: {} } as never);
      expect(order).toContain("a-tool");

      // Only b has onAgentEnd
      await merged.onAgentEnd!({ agent: "test" } as never);
      expect(order).toContain("b-end");
    });

    it("handles async hooks", async () => {
      const order: string[] = [];
      const a: Hooks = {
        onAgentStart: async () => {
          await new Promise((r) => setTimeout(r, 5));
          order.push("a-async");
        },
      };
      const b: Hooks = {
        onAgentStart: () => { order.push("b-sync"); },
      };

      const merged = mergeHooks(a, b)!;
      await merged.onAgentStart!({ agent: "test", input: "" } as never);

      // a finishes first (awaited), then b
      expect(order).toEqual(["a-async", "b-sync"]);
    });
  });

  describe("Sub-agent trace propagation", () => {
    it("sub-agent skips redundant span — LLM calls nest directly under tool span", async () => {
      const subAgent = new Agent({
        name: "sub",
        instructions: "Sub.",
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      globalThis.fetch = createMockFetch([
        // Parent iteration 1: calls sub-agent tool
        toolCallResponse([{ call_id: "c1", name: "delegate", arguments: '{"input":"sub task"}' }]),
        // Sub-agent run (inside tool execute)
        makeORResponse("sub result"),
        // Parent iteration 2: final answer
        makeORResponse("Done with sub result"),
      ]);

      const parent = new Agent({
        name: "parent",
        instructions: "Delegate.",
        tools: [subAgent.asTool({ name: "delegate", description: "Delegate to sub" })],
        client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
      });

      const result = await parent.run("Do the thing");
      expect(result.output).toBe("Done with sub result");

      // Span creates: parent agent + delegate tool only (sub-agent skips its span)
      const creates = spanCreates();
      const agentSpan = creates.find((c) => c.body.name === "parent");
      const toolSpan = creates.find((c) => c.body.name === "delegate");

      expect(agentSpan).toBeDefined();
      expect(toolSpan).toBeDefined();
      // No separate sub-agent span — it was skipped
      expect(creates).toHaveLength(2);

      // Tool span is a child of the agent span
      expect(toolSpan!.body.parent_id).toBe("tool-span-1");
      expect(toolSpan!.body.trace_id).toBe("trace-001");

      // Tool span has SubAgent type and tags
      expect(toolSpan!.body.type).toBe("SubAgent");
      expect(toolSpan!.body.tags).toEqual({ tool: true, subagent: true });

      // Sub-agent's LLM call uses the tool span as parent (via ALS)
      const subAgentLLMCall = orCalls().find((c) =>
        c.headers["X-Opper-Parent-Span-Id"] === "tool-span-2"
      );
      expect(subAgentLLMCall).toBeDefined();
    });
  });
});
