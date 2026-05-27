// =============================================================================
// Agent SDK — structured-output-with-tools fallback
// =============================================================================
//
// When the target model can't accept JSON-schema response format and a
// non-empty `tools` array in the same request, the loop injects a synthetic
// `final_answer` tool whose `parameters` is the requested output schema.
// The model returns its structured answer by calling that tool; the loop
// intercepts that call as terminal.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, tool } from "../agent/index.js";
import {
  FINAL_ANSWER_TOOL_NAME,
  supportsStructuredOutputsWithTools,
  useToolFallback,
} from "../agent/models.js";
import type {
  AgentStreamEvent,
  ORFunctionCallOutputItemResponse,
  ORRequest,
  ORResponse,
} from "../agent/types.js";
import { mockSSEResponseFromOR } from "./_helpers/sse.js";

// ---------------------------------------------------------------------------
// Capability lookup
// ---------------------------------------------------------------------------

describe("supportsStructuredOutputsWithTools", () => {
  it.each([
    "openai/gpt-4o",
    "openai/gpt-5",
    "azure/openai/gpt-4o-mini",
    "anthropic/claude-sonnet-4-6",
    "anthropic/claude-haiku-4-5",
    "gcp/gemini-2.5-flash",
    "google/gemini-3.0-pro",
    "vertexai/gemini-3.5-flash-eu",
  ])("recognises known-capable model: %s", (model) => {
    expect(supportsStructuredOutputsWithTools(model)).toBe(true);
  });

  it.each([
    "mistral/mistral-large",
    "groq/llama-3.1-70b",
    "cohere/command-r-plus",
    "gcp/gemini-1.5-pro", // 1.x family is not capable
    "evroc/moonshotai/Kimi-K2.6",
    "fireworks/glm-5.1",
  ])("falls back for unknown / incapable model: %s", (model) => {
    expect(supportsStructuredOutputsWithTools(model)).toBe(false);
  });

  it("defaults to capable when no model is specified (gateway picks default)", () => {
    expect(supportsStructuredOutputsWithTools(undefined)).toBe(true);
  });

  it("handles ModelConfig objects", () => {
    expect(supportsStructuredOutputsWithTools({ name: "openai/gpt-4o" })).toBe(true);
    expect(supportsStructuredOutputsWithTools({ name: "mistral/mistral-large" })).toBe(false);
  });

  it("follows the first entry of a fallback chain", () => {
    expect(supportsStructuredOutputsWithTools(["openai/gpt-4o", "mistral/mistral-large"])).toBe(
      true,
    );
    expect(supportsStructuredOutputsWithTools(["mistral/mistral-large", "openai/gpt-4o"])).toBe(
      false,
    );
  });
});

describe("useToolFallback", () => {
  it("is inactive without both tools and a schema", () => {
    expect(
      useToolFallback({
        model: "mistral/x",
        hasTools: true,
        hasOutputSchema: false,
        mode: undefined,
      }),
    ).toBe(false);
    expect(
      useToolFallback({
        model: "mistral/x",
        hasTools: false,
        hasOutputSchema: true,
        mode: undefined,
      }),
    ).toBe(false);
  });

  it("uses the capability lookup in auto mode", () => {
    expect(
      useToolFallback({
        model: "mistral/x",
        hasTools: true,
        hasOutputSchema: true,
        mode: "auto",
      }),
    ).toBe(true);
    expect(
      useToolFallback({
        model: "openai/gpt-4o",
        hasTools: true,
        hasOutputSchema: true,
        mode: "auto",
      }),
    ).toBe(false);
  });

  it("native mode disables fallback even when the model is unknown", () => {
    expect(
      useToolFallback({
        model: "mistral/x",
        hasTools: true,
        hasOutputSchema: true,
        mode: "native",
      }),
    ).toBe(false);
  });

  it("tool mode forces fallback even on a capable model", () => {
    expect(
      useToolFallback({
        model: "openai/gpt-4o",
        hasTools: true,
        hasOutputSchema: true,
        mode: "tool",
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loop integration — mocks the SSE stream that the OpenResponses client returns
// ---------------------------------------------------------------------------

function makeORResponse(overrides: Partial<ORResponse> = {}): ORResponse {
  return {
    id: "resp_001",
    object: "response",
    status: "completed",
    created_at: 1700000000,
    model: "test-model",
    output: [],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    ...overrides,
  };
}

function functionCall(call_id: string, name: string, args: string): ORFunctionCallOutputItemResponse {
  return {
    type: "function_call",
    id: `fc_${call_id}`,
    call_id,
    name,
    arguments: args,
    status: "completed",
  };
}

function textOutput(text: string) {
  return {
    type: "message" as const,
    id: "msg_001",
    role: "assistant" as const,
    status: "completed",
    content: [{ type: "output_text", text }],
  };
}

function mockFetchSequence(responses: ORResponse[]) {
  let i = 0;
  return vi.fn().mockImplementation(async () => {
    const resp = responses[i++] ?? responses[responses.length - 1];
    return mockSSEResponseFromOR(resp);
  });
}

const ECHO_TOOL = tool({
  name: "noop",
  description: "echo input",
  parameters: { type: "object", properties: { value: { type: "string" } } },
  execute: async (input) => input,
});

const TEST_SCHEMA = {
  type: "object",
  properties: { answer: { type: "string" } },
  required: ["answer"],
};

describe("Agent — fallback request shape", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("native path: tools array excludes final_answer, text.format is JSON schema", async () => {
    const fetchMock = mockFetchSequence([
      makeORResponse({
        output: [textOutput('{"answer":"hi"}')],
      }),
    ]);
    globalThis.fetch = fetchMock;

    const agent = new Agent({
      name: "native",
      instructions: "...",
      tools: [ECHO_TOOL],
      outputSchema: TEST_SCHEMA,
      model: "openai/gpt-4o",
      tracing: false,
      client: { apiKey: "test", baseUrl: "https://api.test.com" },
    });

    await agent.run("hi");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.text?.format.type).toBe("json_schema");
    const names = body.tools?.map((t) => t.name) ?? [];
    expect(names).toContain("noop");
    expect(names).not.toContain(FINAL_ANSWER_TOOL_NAME);
  });

  it("fallback path: tools include final_answer with the schema as parameters, no text.format", async () => {
    const fetchMock = mockFetchSequence([
      makeORResponse({
        output: [functionCall("fc_1", FINAL_ANSWER_TOOL_NAME, '{"answer":"42"}')],
      }),
    ]);
    globalThis.fetch = fetchMock;

    const agent = new Agent({
      name: "fb",
      instructions: "...",
      tools: [ECHO_TOOL],
      outputSchema: TEST_SCHEMA,
      model: "mistral/mistral-large",
      tracing: false,
      client: { apiKey: "test", baseUrl: "https://api.test.com" },
    });

    await agent.run("hi");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.text).toBeUndefined();
    const synth = body.tools?.find((t) => t.name === FINAL_ANSWER_TOOL_NAME);
    expect(synth).toBeDefined();
    expect(synth?.parameters).toEqual(TEST_SCHEMA);
    expect(body.instructions).toContain(FINAL_ANSWER_TOOL_NAME);
  });

  it("structuredOutputMode=tool forces the fallback even on a whitelisted model", async () => {
    const fetchMock = mockFetchSequence([
      makeORResponse({
        output: [functionCall("fc_1", FINAL_ANSWER_TOOL_NAME, '{"answer":"forced"}')],
      }),
    ]);
    globalThis.fetch = fetchMock;

    const agent = new Agent({
      name: "force",
      instructions: "...",
      tools: [ECHO_TOOL],
      outputSchema: TEST_SCHEMA,
      model: "openai/gpt-4o",
      structuredOutputMode: "tool",
      tracing: false,
      client: { apiKey: "test", baseUrl: "https://api.test.com" },
    });

    await agent.run("hi");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.text).toBeUndefined();
    expect(body.tools?.some((t) => t.name === FINAL_ANSWER_TOOL_NAME)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loop integration — terminal behavior, observability surface
// ---------------------------------------------------------------------------

describe("Agent — fallback runtime behavior", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed structured output and surfaces final_answer as a tool call record", async () => {
    globalThis.fetch = mockFetchSequence([
      makeORResponse({
        output: [functionCall("fc_1", FINAL_ANSWER_TOOL_NAME, '{"answer":"42"}')],
      }),
    ]);

    const agent = new Agent({
      name: "fb",
      instructions: "...",
      tools: [ECHO_TOOL],
      outputSchema: TEST_SCHEMA,
      model: "mistral/mistral-large",
      tracing: false,
      client: { apiKey: "test", baseUrl: "https://api.test.com" },
    });

    const result = await agent.run("hi");

    expect(result.output).toEqual({ answer: "42" });
    expect(result.meta.iterations).toBe(1);

    const faRecords = result.meta.toolCalls.filter((c) => c.name === FINAL_ANSWER_TOOL_NAME);
    expect(faRecords).toHaveLength(1);
    expect(faRecords[0].callId).toBe("fc_1");
    expect(faRecords[0].output).toEqual({ answer: "42" });
  });

  it("emits tool_start / tool_end stream events for the synthetic final_answer", async () => {
    globalThis.fetch = mockFetchSequence([
      makeORResponse({
        output: [functionCall("fc_1", FINAL_ANSWER_TOOL_NAME, '{"answer":"42"}')],
      }),
    ]);

    const agent = new Agent({
      name: "fb",
      instructions: "...",
      tools: [ECHO_TOOL],
      outputSchema: TEST_SCHEMA,
      model: "mistral/mistral-large",
      tracing: false,
      client: { apiKey: "test", baseUrl: "https://api.test.com" },
    });

    const events: AgentStreamEvent[] = [];
    for await (const ev of agent.stream("hi")) {
      events.push(ev);
    }

    const starts = events.filter(
      (e): e is Extract<AgentStreamEvent, { type: "tool_start" }> =>
        e.type === "tool_start" && e.name === FINAL_ANSWER_TOOL_NAME,
    );
    const ends = events.filter(
      (e): e is Extract<AgentStreamEvent, { type: "tool_end" }> =>
        e.type === "tool_end" && e.name === FINAL_ANSWER_TOOL_NAME,
    );
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect(starts[0].input).toEqual({ answer: "42" });
    expect(ends[0].output).toEqual({ answer: "42" });
  });

  it("nudges then succeeds when the model emits prose without calling final_answer", async () => {
    const fetchMock = mockFetchSequence([
      // Iteration 1: model produces text, no tool call.
      makeORResponse({
        id: "resp_1",
        output: [textOutput("I think it's 42")],
      }),
      // Iteration 2: model complies and calls final_answer.
      makeORResponse({
        id: "resp_2",
        output: [functionCall("fc_2", FINAL_ANSWER_TOOL_NAME, '{"answer":"42"}')],
      }),
    ]);
    globalThis.fetch = fetchMock;

    const agent = new Agent({
      name: "fb",
      instructions: "...",
      tools: [ECHO_TOOL],
      outputSchema: TEST_SCHEMA,
      model: "mistral/mistral-large",
      maxIterations: 3,
      tracing: false,
      client: { apiKey: "test", baseUrl: "https://api.test.com" },
    });

    const result = await agent.run("hi");

    expect(result.output).toEqual({ answer: "42" });
    expect(result.meta.iterations).toBe(2);

    // The second request must carry the nudge as a system message.
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body) as ORRequest;
    const items = Array.isArray(secondBody.input) ? secondBody.input : [];
    const nudge = items.find(
      (m) =>
        m.type === "message" &&
        m.role === "system" &&
        typeof m.content === "string" &&
        m.content.includes(FINAL_ANSWER_TOOL_NAME),
    );
    expect(nudge).toBeDefined();
  });

  it("native path stays unchanged for capable models — no synthetic tool, no fallback contract", async () => {
    const fetchMock = mockFetchSequence([
      makeORResponse({
        output: [textOutput('{"answer":"42"}')],
      }),
    ]);
    globalThis.fetch = fetchMock;

    const agent = new Agent({
      name: "native",
      instructions: "...",
      tools: [ECHO_TOOL],
      outputSchema: TEST_SCHEMA,
      model: "openai/gpt-4o",
      tracing: false,
      client: { apiKey: "test", baseUrl: "https://api.test.com" },
    });

    const result = await agent.run("hi");
    expect(result.output).toEqual({ answer: "42" });
    // No final_answer record on the native path.
    expect(
      result.meta.toolCalls.some((c) => c.name === FINAL_ANSWER_TOOL_NAME),
    ).toBe(false);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as ORRequest;
    expect(body.instructions).not.toContain(FINAL_ANSWER_TOOL_NAME);
  });
});
