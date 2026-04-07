import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, tool } from "../agent/index.js";
import type { ORResponse } from "../agent/types.js";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent.asTool() — multi-agent composition", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("creates a valid AgentTool with correct name and description", () => {
    const child = makeAgent({ name: "child-agent" });
    const childTool = child.asTool({ name: "ask_child", description: "Ask the child agent" });

    expect(childTool.name).toBe("ask_child");
    expect(childTool.description).toBe("Ask the child agent");
    expect(childTool.parameters).toEqual({
      type: "object",
      properties: {
        input: { type: "string", description: "The input prompt for the sub-agent" },
      },
      required: ["input"],
    });
    expect(typeof childTool.execute).toBe("function");
  });

  it("executes the sub-agent when the tool is called", async () => {
    // Sub-agent responds directly with text
    globalThis.fetch = mockFetchSequence([textResponse("Sub-agent says hello!")]);

    const child = makeAgent({ name: "child-agent" });
    const childTool = child.asTool({ name: "ask_child", description: "Ask the child" });

    const result = await childTool.execute({ input: "Hello child" });

    expect(result).toEqual({
      output: "Sub-agent says hello!",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      iterations: 1,
      toolCalls: 0,
    });
  });

  it("includes sub-agent tool call count in result", async () => {
    const innerTool = tool({
      name: "lookup",
      description: "Look something up",
      parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
      execute: async () => "found it",
    });

    // Sub-agent: first call triggers tool, second returns text
    globalThis.fetch = mockFetchSequence([
      toolCallResponse([{ call_id: "c1", name: "lookup", arguments: '{"q":"test"}' }]),
      textResponse("Here is what I found"),
    ]);

    const child = makeAgent({ name: "child", tools: [innerTool] });
    const childTool = child.asTool({ name: "research", description: "Research a topic" });

    const result = (await childTool.execute({ input: "Find something" })) as Record<string, unknown>;

    expect(result.output).toBe("Here is what I found");
    expect(result.iterations).toBe(2);
    expect(result.toolCalls).toBe(1);
  });

  it("parent agent can call sub-agent via asTool", async () => {
    // Sequence: parent calls sub-agent tool → sub-agent responds → parent produces final answer
    // Calls 1-2 are the sub-agent (tool call response then text), call 3 is the parent final response
    const fetchResponses = [
      // Parent's first call → decides to call the sub-agent tool
      toolCallResponse([
        { call_id: "p1", name: "ask_expert", arguments: '{"input":"What is 2+2?"}' },
      ]),
      // Sub-agent's call → responds with text (no tools)
      textResponse("The answer is 4."),
      // Parent's second call → final answer incorporating sub-agent result
      textResponse("According to my expert, 2+2 = 4."),
    ];

    globalThis.fetch = mockFetchSequence(fetchResponses);

    const expert = makeAgent({ name: "expert", instructions: "Answer math questions." });
    const parent = makeAgent({
      name: "coordinator",
      instructions: "Delegate questions to the expert.",
      tools: [expert.asTool({ name: "ask_expert", description: "Ask the math expert" })],
    });

    const result = await parent.run("What is 2+2?");

    expect(result.output).toBe("According to my expert, 2+2 = 4.");
    expect(result.meta.iterations).toBe(2);
    expect(result.meta.toolCalls).toHaveLength(1);
    expect(result.meta.toolCalls[0].name).toBe("ask_expert");

    // The tool output should contain the sub-agent's structured result
    const toolOutput = result.meta.toolCalls[0].output as Record<string, unknown>;
    expect(toolOutput.output).toBe("The answer is 4.");
    expect(toolOutput.iterations).toBe(1);
  });

  it("handles sub-agent errors gracefully", async () => {
    // Parent calls sub-agent tool, sub-agent's server call fails
    globalThis.fetch = vi
      .fn()
      // Parent's first call → decides to use sub-agent
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: () =>
          Promise.resolve(
            toolCallResponse([
              { call_id: "p1", name: "ask_child", arguments: '{"input":"test"}' },
            ]),
          ),
        text: () =>
          Promise.resolve(
            JSON.stringify(
              toolCallResponse([
                { call_id: "p1", name: "ask_child", arguments: '{"input":"test"}' },
              ]),
            ),
          ),
      }))
      // Sub-agent's call → server error
      .mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: "Server error" } }),
        text: () => Promise.resolve('{"error":{"message":"Server error"}}'),
      }))
      // Parent's second call → handles the error
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve(textResponse("The sub-agent encountered an error.")),
        text: () => Promise.resolve(JSON.stringify(textResponse("The sub-agent encountered an error."))),
      }));

    const child = makeAgent({ name: "child" });
    const parent = makeAgent({
      name: "parent",
      tools: [child.asTool({ name: "ask_child", description: "Ask the child" })],
    });

    const result = await parent.run("Ask the child something");

    // Parent should still complete — the tool error is fed back to the model
    expect(result.output).toBe("The sub-agent encountered an error.");
    expect(result.meta.toolCalls[0].error).toBeDefined();
  });

  it("works with hooks on both parent and sub-agent", async () => {
    globalThis.fetch = mockFetchSequence([
      toolCallResponse([{ call_id: "p1", name: "ask_child", arguments: '{"input":"hi"}' }]),
      textResponse("child says hi"),
      textResponse("parent done"),
    ]);

    const parentLog: string[] = [];
    const childLog: string[] = [];

    const child = makeAgent({
      name: "child",
      hooks: {
        onAgentStart: () => { childLog.push("child:start"); },
        onAgentEnd: () => { childLog.push("child:end"); },
      },
    });

    const parent = makeAgent({
      name: "parent",
      tools: [child.asTool({ name: "ask_child", description: "Ask child" })],
      hooks: {
        onAgentStart: () => { parentLog.push("parent:start"); },
        onToolStart: ({ name }) => { parentLog.push(`parent:tool:${name}`); },
        onToolEnd: ({ name }) => { parentLog.push(`parent:toolEnd:${name}`); },
        onAgentEnd: () => { parentLog.push("parent:end"); },
      },
    });

    await parent.run("hello");

    expect(parentLog).toEqual([
      "parent:start",
      "parent:tool:ask_child",
      "parent:toolEnd:ask_child",
      "parent:end",
    ]);
    expect(childLog).toEqual(["child:start", "child:end"]);
  });
});
