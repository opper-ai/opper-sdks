// =============================================================================
// Agent SDK — structured-output robustness fixes
// =============================================================================
//
// Covers:
//   - useToolFallback honoring mode="tool" for tool-less agents
//   - a 16k default max_output_tokens when the caller sets none
//   - extractText concatenating every output_text part
//   - tolerant JSON parsing (markdown fences, embedded object)
//   - a diagnostic AgentError (with truncation hint) when a schema is set but
//     the model returns nothing parseable

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, AgentError } from "../agent/index.js";
import { DEFAULT_MAX_OUTPUT_TOKENS } from "../agent/loop.js";
import { useToolFallback } from "../agent/models.js";
import type { ORRequest, ORResponse } from "../agent/types.js";
import { mockSSEResponseFromOR } from "./_helpers/sse.js";

const SCHEMA = {
  type: "object",
  properties: { answer: { type: "string" } },
  required: ["answer"],
};

function makeORResponse(overrides: Partial<ORResponse> = {}): ORResponse {
  return {
    id: "resp_001",
    object: "response",
    status: "completed",
    created_at: 1700000000,
    model: "openai/gpt-4o",
    output: [],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    ...overrides,
  };
}

function textResponse(parts: string[], overrides: Partial<ORResponse> = {}): ORResponse {
  return makeORResponse({
    output: [
      {
        type: "message",
        id: "msg_001",
        role: "assistant",
        status: "completed",
        content: parts.map((text) => ({ type: "output_text", text })),
      },
    ],
    ...overrides,
  });
}

function mockFetchOnce(resp: ORResponse) {
  return vi.fn().mockImplementation(async () => mockSSEResponseFromOR(resp));
}

function makeAgent(overrides: Record<string, unknown> = {}) {
  return new Agent({
    name: "so-agent",
    instructions: "answer",
    model: "openai/gpt-4o", // native path, no tool fallback
    outputSchema: SCHEMA,
    tracing: false,
    client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// useToolFallback ordering (P0)
// ---------------------------------------------------------------------------

describe("useToolFallback ordering", () => {
  it("forces fallback for mode='tool' even without tools", () => {
    expect(
      useToolFallback({
        model: "openai/gpt-4o",
        hasTools: false,
        hasOutputSchema: true,
        mode: "tool",
      }),
    ).toBe(true);
  });

  it("auto mode still requires tools", () => {
    expect(
      useToolFallback({ model: "mistral/x", hasTools: false, hasOutputSchema: true, mode: "auto" }),
    ).toBe(false);
  });

  it("never falls back without a schema", () => {
    expect(
      useToolFallback({ model: "mistral/x", hasTools: true, hasOutputSchema: false, mode: "tool" }),
    ).toBe(false);
  });

  it("native mode disables even without tools", () => {
    expect(
      useToolFallback({
        model: "mistral/x",
        hasTools: false,
        hasOutputSchema: true,
        mode: "native",
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default max_output_tokens (P2) + structured-output behavior
// ---------------------------------------------------------------------------

describe("structured-output robustness", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("applies a 16k default max_output_tokens when unset", async () => {
    const fetchMock = mockFetchOnce(textResponse(['{"answer":"42"}']));
    globalThis.fetch = fetchMock;

    await makeAgent().run("q");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.max_output_tokens).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(DEFAULT_MAX_OUTPUT_TOKENS).toBe(16000);
  });

  it("lets an explicit maxTokens win over the default", async () => {
    const fetchMock = mockFetchOnce(textResponse(['{"answer":"42"}']));
    globalThis.fetch = fetchMock;

    await makeAgent({ maxTokens: 500 }).run("q");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.max_output_tokens).toBe(500);
  });

  it("concatenates output_text parts before parsing", async () => {
    globalThis.fetch = mockFetchOnce(textResponse(['{"ans', 'wer":"42"}']));
    const result = await makeAgent().run("q");
    expect(result.output).toEqual({ answer: "42" });
  });

  it("rescues markdown-fenced JSON", async () => {
    globalThis.fetch = mockFetchOnce(textResponse(['```json\n{"answer":"42"}\n```']));
    const result = await makeAgent().run("q");
    expect(result.output).toEqual({ answer: "42" });
  });

  it("throws when a schema is set but the model returns no text", async () => {
    // reasoning-only response: no output_text part at all
    globalThis.fetch = mockFetchOnce(makeORResponse({ output: [] }));
    await expect(makeAgent().run("q")).rejects.toThrow(/did not return a parseable/);
  });

  it("throws with a truncation hint on truncated JSON", async () => {
    globalThis.fetch = mockFetchOnce(
      textResponse(['{"answer":"the meaning of'], {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        usage: { input_tokens: 1, output_tokens: 4096, total_tokens: 4097 },
      }),
    );
    await expect(makeAgent().run("q")).rejects.toThrow(/truncated/);
  });

  it("surfaces a real AgentError instance", async () => {
    globalThis.fetch = mockFetchOnce(makeORResponse({ output: [] }));
    await expect(makeAgent().run("q")).rejects.toBeInstanceOf(AgentError);
  });
});
