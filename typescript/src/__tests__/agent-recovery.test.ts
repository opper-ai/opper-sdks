import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, AgentError, type RetryPolicy } from "../agent/index.js";
import type { ORResponse, ORStreamEvent } from "../agent/types.js";
import { InternalServerError, RateLimitError, AuthenticationError } from "../types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function textResponse(text: string, overrides: Partial<ORResponse> = {}): ORResponse {
  return {
    id: "resp_001",
    object: "response",
    status: "completed",
    created_at: 1700000000,
    model: "anthropic/claude-sonnet-4-6",
    output: [
      {
        type: "message",
        id: "msg_001",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    ...overrides,
  };
}

function errorResponse(message: string): ORResponse {
  return {
    id: "resp_err",
    object: "response",
    status: "failed",
    created_at: 1700000000,
    model: "anthropic/claude-sonnet-4-6",
    output: [],
    usage: { input_tokens: 10, output_tokens: 0, total_tokens: 10 },
    error: { code: "server_error", message },
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

const FAST_RETRY: RetryPolicy = { maxRetries: 2, initialDelayMs: 1, backoffMultiplier: 1 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent error recovery", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Retry with backoff
  // -----------------------------------------------------------------------

  describe("retry with backoff", () => {
    it("retries on 500 and succeeds", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500, statusText: "Internal Server Error", headers: new Headers(), text: () => Promise.resolve("error"), json: () => Promise.resolve({ error: { code: "server_error", message: "down" } }) };
        }
        return {
          ok: true, status: 200, statusText: "OK",
          headers: new Headers({ "content-length": "100" }),
          json: () => Promise.resolve(textResponse("recovered")),
          text: () => Promise.resolve(JSON.stringify(textResponse("recovered"))),
        };
      });

      const agent = makeAgent({ retry: FAST_RETRY });
      const result = await agent.run("hello");
      expect(result.output).toBe("recovered");
      // 1 failed + 1 success = 2 calls
      expect(callCount).toBe(2);
    });

    it("retries on 429 rate limit", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return { ok: false, status: 429, statusText: "Too Many Requests", headers: new Headers(), text: () => Promise.resolve("rate limited"), json: () => Promise.resolve({ error: { code: "rate_limit", message: "slow down" } }) };
        }
        return {
          ok: true, status: 200, statusText: "OK",
          headers: new Headers({ "content-length": "100" }),
          json: () => Promise.resolve(textResponse("ok after rate limit")),
          text: () => Promise.resolve(JSON.stringify(textResponse("ok after rate limit"))),
        };
      });

      const agent = makeAgent({ retry: FAST_RETRY });
      const result = await agent.run("hello");
      expect(result.output).toBe("ok after rate limit");
      expect(callCount).toBe(3);
    });

    it("does not retry auth errors (401)", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: false, status: 401, statusText: "Unauthorized", headers: new Headers(),
        text: () => Promise.resolve("unauthorized"),
        json: () => Promise.resolve({ error: { code: "auth", message: "bad key" } }),
      }));

      const agent = makeAgent({ retry: FAST_RETRY });
      await expect(agent.run("hello")).rejects.toThrow(AuthenticationError);
      // Only 1 call — no retries
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("injects error as context after retries exhausted", async () => {
      let callCount = 0;
      const requests: unknown[] = [];
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        callCount++;
        if (callCount <= 3) {
          // All 3 attempts (1 + 2 retries) fail
          return { ok: false, status: 500, statusText: "Internal Server Error", headers: new Headers(), text: () => Promise.resolve("down"), json: () => Promise.resolve({ error: { code: "server_error", message: "down" } }) };
        }
        // 4th call succeeds (next iteration after error injection)
        requests.push(JSON.parse(init.body as string));
        return {
          ok: true, status: 200, statusText: "OK",
          headers: new Headers({ "content-length": "100" }),
          json: () => Promise.resolve(textResponse("recovered after injection")),
          text: () => Promise.resolve(JSON.stringify(textResponse("recovered after injection"))),
        };
      });

      const agent = makeAgent({ retry: FAST_RETRY, maxIterations: 3 });
      const result = await agent.run("hello");
      expect(result.output).toBe("recovered after injection");
      // 3 failed attempts + 1 success = 4
      expect(callCount).toBe(4);
      // The successful request should contain the error injection message
      const lastRequest = requests[0] as { input: Array<{ type: string; role: string; content: string }> };
      const errorMsg = lastRequest.input.find(
        (item: { role: string }) => item.role === "system" && item.content?.includes("[Error]"),
      );
      expect(errorMsg).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // response.error recovery
  // -----------------------------------------------------------------------

  describe("response.error recovery", () => {
    it("injects response.error as context and continues", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        const resp = callCount === 1 ? errorResponse("model overloaded") : textResponse("ok now");
        return {
          ok: true, status: 200, statusText: "OK",
          headers: new Headers({ "content-length": "100" }),
          json: () => Promise.resolve(resp),
          text: () => Promise.resolve(JSON.stringify(resp)),
        };
      });

      const agent = makeAgent({ retry: FAST_RETRY, maxIterations: 3 });
      const result = await agent.run("hello");
      expect(result.output).toBe("ok now");
      expect(callCount).toBe(2);
    });

    it("throws response.error without retry config", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true, status: 200, statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve(errorResponse("boom")),
        text: () => Promise.resolve(JSON.stringify(errorResponse("boom"))),
      }));

      const agent = makeAgent(); // no retry
      await expect(agent.run("hello")).rejects.toThrow(AgentError);
    });
  });

  // -----------------------------------------------------------------------
  // onMaxIterations: "return_partial"
  // -----------------------------------------------------------------------

  describe("onMaxIterations", () => {
    it("returns partial result when set to return_partial", async () => {
      const toolCallResp: ORResponse = {
        id: "resp_001",
        object: "response",
        status: "completed",
        created_at: 1700000000,
        model: "anthropic/claude-sonnet-4-6",
        output: [
          {
            type: "function_call",
            id: "fc_0",
            call_id: "call_1",
            name: "noop",
            arguments: "{}",
            status: "completed",
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      };

      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true, status: 200, statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve(toolCallResp),
        text: () => Promise.resolve(JSON.stringify(toolCallResp)),
      }));

      const noop = { name: "noop", execute: async () => "done" };
      const agent = makeAgent({
        tools: [noop],
        maxIterations: 2,
        onMaxIterations: "return_partial",
      });

      const result = await agent.run("hello");
      // Should return instead of throwing
      // With turn awareness, loop runs up to maxIterations + 1 (recovery turn)
      expect(result.meta.iterations).toBe(3);
      expect(result.meta.toolCalls.length).toBeGreaterThan(0);
    });

    it("throws MaxIterationsError by default", async () => {
      const toolCallResp: ORResponse = {
        id: "resp_001",
        object: "response",
        status: "completed",
        created_at: 1700000000,
        model: "anthropic/claude-sonnet-4-6",
        output: [
          {
            type: "function_call",
            id: "fc_0",
            call_id: "call_1",
            name: "noop",
            arguments: "{}",
            status: "completed",
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      };

      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true, status: 200, statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve(toolCallResp),
        text: () => Promise.resolve(JSON.stringify(toolCallResp)),
      }));

      const noop = { name: "noop", execute: async () => "done" };
      const agent = makeAgent({ tools: [noop], maxIterations: 1 });
      await expect(agent.run("hello")).rejects.toThrow("max iterations");
    });
  });

  // -----------------------------------------------------------------------
  // onError hook
  // -----------------------------------------------------------------------

  describe("onError hook", () => {
    it("fires onError on retry and on final injection", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return { ok: false, status: 500, statusText: "Internal Server Error", headers: new Headers(), text: () => Promise.resolve("down"), json: () => Promise.resolve({ error: { code: "server_error", message: "down" } }) };
        }
        return {
          ok: true, status: 200, statusText: "OK",
          headers: new Headers({ "content-length": "100" }),
          json: () => Promise.resolve(textResponse("ok")),
          text: () => Promise.resolve(JSON.stringify(textResponse("ok"))),
        };
      });

      const errorEvents: Array<{ willRetry: boolean; error: Error }> = [];
      const agent = makeAgent({
        retry: { maxRetries: 1, initialDelayMs: 1, backoffMultiplier: 1 },
        maxIterations: 3,
        hooks: {
          onError: (ctx: { willRetry: boolean; error: Error }) => {
            errorEvents.push({ willRetry: ctx.willRetry, error: ctx.error });
          },
        },
      });

      const result = await agent.run("hello");
      expect(result.output).toBe("ok");

      // 1st attempt fails → onError(willRetry: true) from withRetry
      // 2nd attempt fails → retries exhausted → onError(willRetry: false) from catch
      // 3rd attempt succeeds
      expect(errorEvents.length).toBe(2);
      expect(errorEvents[0].willRetry).toBe(true);
      expect(errorEvents[1].willRetry).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Streaming recovery
  // -----------------------------------------------------------------------

  describe("streaming recovery", () => {
    it("retries stream errors and recovers", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500, statusText: "Internal Server Error", headers: new Headers(), text: () => Promise.resolve("down"), json: () => Promise.resolve({}) };
        }
        // Return a successful SSE stream
        const sseBody = [
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"ok"}\n\n',
          `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: textResponse("ok") })}\n\n`,
        ].join("");
        return {
          ok: true, status: 200, statusText: "OK",
          headers: new Headers({ "content-type": "text/event-stream" }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sseBody));
              controller.close();
            },
          }),
        };
      });

      const agent = makeAgent({ retry: FAST_RETRY });
      const stream = agent.stream("hello");
      const result = await stream.result();
      expect(result.output).toBe("ok");
      expect(callCount).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Fatal 4xx errors — surface immediately, do not recover across iterations
  // -----------------------------------------------------------------------

  describe("fatal 4xx handling", () => {
    it("Agent.stream() surfaces 400 on the first iteration and does not retry", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve('{"error":{"code":"model_not_found","message":"bad"}}'),
          json: () =>
            Promise.resolve({ error: { code: "model_not_found", message: "bad" } }),
        };
      });

      const agent = makeAgent({ retry: FAST_RETRY });
      await expect(async () => {
        const stream = agent.stream("hello");
        for await (const _ of stream) {
          /* drain */
        }
        await stream.result();
      }).rejects.toThrow(/400 Bad Request/);
      // Exactly one fetch: no retry, no 25-iteration recovery.
      expect(callCount).toBe(1);
    });

    it("404 Not Found is fatal and surfaces immediately", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve('{"error":{"code":"nope","message":"missing"}}'),
          json: () =>
            Promise.resolve({ error: { code: "nope", message: "missing" } }),
        };
      });

      const agent = makeAgent({ retry: FAST_RETRY });
      await expect(agent.run("hello")).rejects.toThrow(/404 Not Found/);
      expect(callCount).toBe(1);
    });
  });
});
