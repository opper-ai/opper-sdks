import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent } from "../index.js";
import type { ORResponse } from "../agent/types.js";
import { mockSSEResponseFromOR } from "./_helpers/sse.js";

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

let fetchCalls: FetchCall[];

function makeORResponse(text: string): ORResponse {
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
  };
}

function spanResponse(id: string, traceId: string) {
  return { data: { id, trace_id: traceId, name: "test" } };
}

function createMockFetch(orResponses: ORResponse[], traceId = "trace-server"): ReturnType<typeof vi.fn> {
  let orCallIndex = 0;
  let spanCounter = 0;

  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const headers = Object.fromEntries(
      Object.entries(init?.headers ?? {}).map(([k, v]) => [k, String(v)]),
    );
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    fetchCalls.push({ url, method: init?.method ?? "GET", headers, body });

    if (url.includes("/v3/spans") && init?.method === "POST") {
      spanCounter++;
      const id = `span-${spanCounter}`;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: async () => spanResponse(id, traceId),
        text: async () => JSON.stringify(spanResponse(id, traceId)),
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
      return mockSSEResponseFromOR(resp);
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

function spanCreates(): FetchCall[] {
  return fetchCalls.filter((c) => c.url.includes("/v3/spans") && c.method === "POST");
}

function orBodies(): Array<Record<string, unknown>> {
  return fetchCalls
    .filter((c) => c.url.includes("/v3/compat/openresponses"))
    .map((c) => c.body as Record<string, unknown>);
}

describe("Agent bug fixes", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("parentSpanId override (BUG-1)", () => {
    it("honours explicit parentSpanId on run()", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("ok")]);

      const agent = new Agent({
        name: "t",
        instructions: "x",
        client: { apiKey: "k", baseUrl: "https://api.test.com" },
      });

      await agent.run("hi", { parentSpanId: "user-parent-span" });

      const [create] = spanCreates();
      expect(create.body).toMatchObject({ parent_id: "user-parent-span" });
      // Explicit parent → trace_id is not sent (server assigns one).
      expect((create.body as { trace_id?: string }).trace_id).toBeUndefined();
    });

    it("does not send parent/trace fields when no parentSpanId and no ambient context", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("ok")]);

      const agent = new Agent({
        name: "t",
        instructions: "x",
        client: { apiKey: "k", baseUrl: "https://api.test.com" },
      });

      await agent.run("hi");

      const [create] = spanCreates();
      expect((create.body as { parent_id?: string }).parent_id).toBeUndefined();
      expect((create.body as { trace_id?: string }).trace_id).toBeUndefined();
    });
  });

  describe("model fallback list (FB-A)", () => {
    it("passes a string model through unchanged", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("ok")]);

      const agent = new Agent({
        name: "t",
        instructions: "x",
        model: "anthropic/claude-haiku-4-5",
        client: { apiKey: "k", baseUrl: "https://api.test.com" },
      });

      await agent.run("hi");

      const [body] = orBodies();
      expect(body.model).toBe("anthropic/claude-haiku-4-5");
    });

    it("passes a fallback-chain array through unchanged", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("ok")]);

      const agent = new Agent({
        name: "t",
        instructions: "x",
        model: ["anthropic/claude-haiku-4-5", "arcee/trinity-mini"],
        client: { apiKey: "k", baseUrl: "https://api.test.com" },
      });

      await agent.run("hi");

      const [body] = orBodies();
      expect(body.model).toEqual([
        "anthropic/claude-haiku-4-5",
        "arcee/trinity-mini",
      ]);
    });

    it("passes a ModelConfig object through unchanged", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("ok")]);

      const agent = new Agent({
        name: "t",
        instructions: "x",
        model: { name: "anthropic/claude-haiku-4-5", options: { thinking: { budget_tokens: 1024 } } },
        client: { apiKey: "k", baseUrl: "https://api.test.com" },
      });

      await agent.run("hi");

      const [body] = orBodies();
      expect(body.model).toEqual({
        name: "anthropic/claude-haiku-4-5",
        options: { thinking: { budget_tokens: 1024 } },
      });
    });

    it("per-run options.model overrides agent-level model and accepts a list", async () => {
      globalThis.fetch = createMockFetch([makeORResponse("ok")]);

      const agent = new Agent({
        name: "t",
        instructions: "x",
        model: "anthropic/claude-haiku-4-5",
        client: { apiKey: "k", baseUrl: "https://api.test.com" },
      });

      await agent.run("hi", { model: ["gcp/gemini-2.5-flash", "openai/gpt-4o-mini"] });

      const [body] = orBodies();
      expect(body.model).toEqual(["gcp/gemini-2.5-flash", "openai/gpt-4o-mini"]);
    });
  });
});
