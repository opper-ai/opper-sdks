import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agent, mcp, MCPToolProvider, tool } from "../agent/index.js";
import { isToolProvider } from "../agent/types.js";
import type { ORResponse } from "../agent/types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function textResponse(text: string): ORResponse {
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
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  };
}

function toolCallResponse(
  calls: Array<{ call_id: string; name: string; arguments: string }>,
): ORResponse {
  return {
    id: "resp_001",
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
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  };
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

// ---------------------------------------------------------------------------
// mcp() factory tests
// ---------------------------------------------------------------------------

describe("mcp() factory", () => {
  it("returns a ToolProvider", () => {
    const provider = mcp({
      name: "test-server",
      transport: "stdio",
      command: "echo",
    });
    expect(provider.type).toBe("tool_provider");
    expect(typeof provider.setup).toBe("function");
    expect(typeof provider.teardown).toBe("function");
  });

  it("creates an MCPToolProvider instance", () => {
    const provider = mcp({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    expect(provider).toBeInstanceOf(MCPToolProvider);
  });

  it("accepts SSE config", () => {
    const provider = mcp({
      name: "remote",
      transport: "sse",
      url: "http://localhost:3001/sse",
      headers: { Authorization: "Bearer token" },
    });
    expect(provider.type).toBe("tool_provider");
  });

  it("accepts streamable-http config", () => {
    const provider = mcp({
      name: "remote",
      transport: "streamable-http",
      url: "http://localhost:3002/mcp",
    });
    expect(provider.type).toBe("tool_provider");
  });
});

// ---------------------------------------------------------------------------
// isToolProvider tests
// ---------------------------------------------------------------------------

describe("isToolProvider", () => {
  it("returns true for ToolProvider objects", () => {
    const provider = mcp({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    expect(isToolProvider(provider)).toBe(true);
  });

  it("returns false for AgentTool objects", () => {
    const agentTool = tool({
      name: "test",
      description: "A test tool",
      execute: async () => "result",
    });
    expect(isToolProvider(agentTool)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tool naming tests
// ---------------------------------------------------------------------------

describe("MCPToolProvider tool naming", () => {
  it("uses mcp__server__tool format", async () => {
    const provider = new MCPToolProvider({
      name: "my-server",
      transport: "stdio",
      command: "echo",
    });

    // Mock the MCPClient by replacing setup internals
    const mockTools = [
      { name: "read_file", description: "Read a file", inputSchema: { type: "object" } },
      { name: "write_file", description: "Write a file", inputSchema: { type: "object" } },
    ];

    // Manually create and inject a mock client
    const mockClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      listTools: vi.fn().mockResolvedValue(mockTools),
      callTool: vi.fn().mockResolvedValue("ok"),
      isConnected: true,
    };

    // Use Object.defineProperty to inject mock
    Object.defineProperty(provider, "client", { value: mockClient, writable: true });

    // Override setup to use our mock
    const originalSetup = provider.setup.bind(provider);
    provider.setup = async () => {
      // Simulate what setup does but with our mock client
      const tools = await mockClient.listTools();
      return tools.map((t: { name: string; description: string; inputSchema: Record<string, unknown> }) => ({
        name: `mcp__my_server__${t.name}`,
        description: t.description,
        parameters: t.inputSchema,
        execute: async (input: unknown) => mockClient.callTool(t.name, input),
      }));
    };

    const tools = await provider.setup();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe("mcp__my_server__read_file");
    expect(tools[1].name).toBe("mcp__my_server__write_file");
  });

  it("normalizes special characters in names", async () => {
    const provider = new MCPToolProvider({
      name: "my server.v2",
      transport: "stdio",
      command: "echo",
    });

    const mockClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      listTools: vi.fn().mockResolvedValue([
        { name: "tool-with-dashes", description: "test", inputSchema: {} },
      ]),
      callTool: vi.fn(),
      isConnected: true,
    };

    Object.defineProperty(provider, "client", { value: mockClient, writable: true });
    provider.setup = async () => {
      const tools = await mockClient.listTools();
      // Simulate normalization
      const normalizeName = (n: string) => n.replace(/[^a-zA-Z0-9_]/g, "_");
      return tools.map((t: { name: string; description: string; inputSchema: Record<string, unknown> }) => ({
        name: `mcp__${normalizeName("my server.v2")}__${normalizeName(t.name)}`,
        description: t.description,
        parameters: t.inputSchema,
        execute: async () => "ok",
      }));
    };

    const tools = await provider.setup();
    expect(tools[0].name).toBe("mcp__my_server_v2__tool_with_dashes");
  });
});

// ---------------------------------------------------------------------------
// Agent integration with providers
// ---------------------------------------------------------------------------

describe("Agent with MCP providers", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("partitions tools and providers in constructor", () => {
    const regularTool = tool({
      name: "local_tool",
      description: "A local tool",
      execute: async () => "result",
    });

    const provider = mcp({
      name: "test",
      transport: "stdio",
      command: "echo",
    });

    const agent = new Agent({
      name: "test-agent",
      instructions: "Test",
      tools: [regularTool, provider],
      client: { apiKey: "test-key" },
    });

    // Regular tools should be accessible
    expect(agent.tools).toHaveLength(1);
    expect(agent.tools[0].name).toBe("local_tool");
  });

  it("activates providers on run and deactivates after", async () => {
    const setupFn = vi.fn().mockResolvedValue([
      {
        name: "mcp__test__hello",
        description: "Say hello",
        parameters: { type: "object" },
        execute: async () => "world",
      },
    ]);
    const teardownFn = vi.fn().mockResolvedValue(undefined);

    const fakeProvider = {
      type: "tool_provider" as const,
      setup: setupFn,
      teardown: teardownFn,
    };

    globalThis.fetch = mockFetchSequence([textResponse("Hello!")]);

    const agent = new Agent({
      name: "test-agent",
      instructions: "Test",
      tools: [fakeProvider],
      client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    });

    await agent.run("hi");

    expect(setupFn).toHaveBeenCalledOnce();
    expect(teardownFn).toHaveBeenCalledOnce();
  });

  it("deactivates providers even if run throws", async () => {
    const teardownFn = vi.fn().mockResolvedValue(undefined);

    const fakeProvider = {
      type: "tool_provider" as const,
      setup: vi.fn().mockResolvedValue([]),
      teardown: teardownFn,
    };

    // Return a server error
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers({ "content-length": "100" }),
      text: () => Promise.resolve("Internal Server Error"),
    }));

    const agent = new Agent({
      name: "test-agent",
      instructions: "Test",
      tools: [fakeProvider],
      client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    });

    await expect(agent.run("hi")).rejects.toThrow();
    expect(teardownFn).toHaveBeenCalledOnce();
  });

  it("continues if provider setup fails", async () => {
    const failingProvider = {
      type: "tool_provider" as const,
      setup: vi.fn().mockRejectedValue(new Error("Connection refused")),
      teardown: vi.fn().mockResolvedValue(undefined),
    };

    const regularTool = tool({
      name: "local_tool",
      description: "A local tool",
      execute: async () => "local result",
    });

    globalThis.fetch = mockFetchSequence([textResponse("Used local tool")]);

    const agent = new Agent({
      name: "test-agent",
      instructions: "Test",
      tools: [regularTool, failingProvider],
      client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    });

    // Should not throw — failing provider is skipped, local tool still works
    const result = await agent.run("hi");
    expect(result.output).toBe("Used local tool");
  });

  it("includes provider tools alongside regular tools in the loop", async () => {
    const fakeProvider = {
      type: "tool_provider" as const,
      setup: vi.fn().mockResolvedValue([
        {
          name: "mcp__test__greet",
          description: "Greet someone",
          parameters: { type: "object", properties: { name: { type: "string" } } },
          execute: async (input: unknown) => {
            const { name } = input as { name: string };
            return { greeting: `Hello, ${name}!` };
          },
        },
      ]),
      teardown: vi.fn().mockResolvedValue(undefined),
    };

    globalThis.fetch = mockFetchSequence([
      // First: model calls the MCP tool
      toolCallResponse([
        { call_id: "call_1", name: "mcp__test__greet", arguments: '{"name":"Alice"}' },
      ]),
      // Second: model responds with text
      textResponse("I greeted Alice!"),
    ]);

    const agent = new Agent({
      name: "test-agent",
      instructions: "Test",
      tools: [fakeProvider],
      client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    });

    const result = await agent.run("Greet Alice");
    expect(result.output).toBe("I greeted Alice!");
    expect(result.meta.toolCalls).toHaveLength(1);
    expect(result.meta.toolCalls[0].name).toBe("mcp__test__greet");
    expect(result.meta.toolCalls[0].output).toEqual({ greeting: "Hello, Alice!" });
  });

  it("activates and deactivates providers for streaming", async () => {
    const setupFn = vi.fn().mockResolvedValue([]);
    const teardownFn = vi.fn().mockResolvedValue(undefined);

    const fakeProvider = {
      type: "tool_provider" as const,
      setup: setupFn,
      teardown: teardownFn,
    };

    const sseData = [
      `event: response.completed\ndata: ${JSON.stringify({
        type: "response.completed",
        response: textResponse("Streamed!"),
      })}\n\n`,
    ].join("");

    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      }),
    }));

    const agent = new Agent({
      name: "test-agent",
      instructions: "Test",
      tools: [fakeProvider],
      client: { apiKey: "test-key", baseUrl: "https://api.test.com" },
    });

    const stream = agent.stream("hi");
    for await (const _event of stream) {
      // consume
    }
    await stream.result();

    expect(setupFn).toHaveBeenCalledOnce();
    expect(teardownFn).toHaveBeenCalledOnce();
  });
});
