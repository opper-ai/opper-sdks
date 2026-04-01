import { describe, expect, it } from "vitest";
import { tool, resolveToolSchema } from "../agent/index.js";
import type { AgentTool, ORTool } from "../agent/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an AgentTool to the ORTool wire format (strip execute, add type). */
function toORTool(t: AgentTool): ORTool {
  return {
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tool()", () => {
  it("creates an AgentTool from config", () => {
    const getTicker = tool({
      name: "get_ticker",
      description: "Look up a stock ticker",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
      execute: async ({ symbol }: { symbol: string }) => ({ price: 123 }),
    });

    expect(getTicker.name).toBe("get_ticker");
    expect(getTicker.description).toBe("Look up a stock ticker");
    expect(getTicker.parameters).toEqual({
      type: "object",
      properties: { symbol: { type: "string" } },
      required: ["symbol"],
    });
    expect(typeof getTicker.execute).toBe("function");
  });

  it("creates a tool without parameters", () => {
    const noParams = tool({
      name: "get_time",
      description: "Get current time",
      execute: async () => new Date().toISOString(),
    });

    expect(noParams.name).toBe("get_time");
    expect(noParams.parameters).toBeUndefined();
  });

  it("supports timeoutMs", () => {
    const slow = tool({
      name: "slow_query",
      description: "Run a slow database query",
      parameters: { type: "object", properties: { sql: { type: "string" } } },
      timeoutMs: 30_000,
      execute: async () => "done",
    });

    expect(slow.timeoutMs).toBe(30_000);
  });

  it("execute receives parsed input and returns result", async () => {
    const add = tool({
      name: "add",
      description: "Add two numbers",
      parameters: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
      execute: async ({ a, b }: { a: number; b: number }) => ({ sum: a + b }),
    });

    const result = await add.execute({ a: 2, b: 3 });
    expect(result).toEqual({ sum: 5 });
  });

  it("execute can return primitives", async () => {
    const echo = tool({
      name: "echo",
      description: "Echo input",
      execute: async (input: unknown) => `echo: ${input}`,
    });

    const result = await echo.execute("hello");
    expect(result).toBe("echo: hello");
  });

  it("execute can throw errors", async () => {
    const failing = tool({
      name: "fail",
      description: "Always fails",
      execute: async () => {
        throw new Error("Something went wrong");
      },
    });

    await expect(failing.execute({})).rejects.toThrow("Something went wrong");
  });

  it("supports sync execute functions", async () => {
    const sync = tool({
      name: "sync_tool",
      description: "A sync tool",
      execute: (input: unknown) => ({ received: input }),
    });

    const result = await Promise.resolve(sync.execute({ test: true }));
    expect(result).toEqual({ received: { test: true } });
  });
});

describe("toORTool() conversion", () => {
  it("converts AgentTool to ORTool wire format", () => {
    const agentTool = tool({
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      execute: async () => ({}),
    });

    const orTool = toORTool(agentTool);

    expect(orTool).toEqual({
      type: "function",
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    });
  });

  it("strips execute and timeoutMs from wire format", () => {
    const agentTool = tool({
      name: "test",
      description: "Test",
      timeoutMs: 5000,
      execute: async () => "result",
    });

    const orTool = toORTool(agentTool);

    expect(orTool).toEqual({
      type: "function",
      name: "test",
      description: "Test",
      parameters: undefined,
    });
    expect("execute" in orTool).toBe(false);
    expect("timeoutMs" in orTool).toBe(false);
  });
});

describe("resolveToolSchema()", () => {
  it("passes through plain JSON Schema parameters unchanged", async () => {
    const t = tool({
      name: "test",
      description: "Test",
      parameters: { type: "object", properties: { x: { type: "number" } } },
      execute: async () => ({}),
    });

    const resolved = await resolveToolSchema(t);
    expect(resolved.parameters).toEqual({
      type: "object",
      properties: { x: { type: "number" } },
    });
  });

  it("returns tool unchanged when no parameters", async () => {
    const t = tool({
      name: "test",
      description: "Test",
      execute: async () => ({}),
    });

    const resolved = await resolveToolSchema(t);
    expect(resolved.parameters).toBeUndefined();
  });

  it("does not mutate the original tool", async () => {
    const t = tool({
      name: "test",
      description: "Test",
      parameters: { type: "object" },
      execute: async () => ({}),
    });

    const resolved = await resolveToolSchema(t);
    // Should be the same reference since no conversion needed
    expect(resolved.name).toBe("test");
    expect(resolved.execute).toBe(t.execute);
  });
});
