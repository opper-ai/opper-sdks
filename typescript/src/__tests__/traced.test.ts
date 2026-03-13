import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Opper } from "../index.js";

// Track all fetch calls for inspection
let fetchCalls: Array<{ url: string; init: RequestInit; body?: unknown }>;

function mockFetchSequence(responses: Array<{ body: object; status?: number }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    const status = resp.status ?? 200;
    const json = JSON.stringify(resp.body);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: new Headers({ "content-length": String(json.length) }),
      json: () => Promise.resolve(resp.body),
      text: () => Promise.resolve(json),
    });
  });
}

function captureFetch(mock: ReturnType<typeof vi.fn>) {
  return () =>
    mock.mock.calls.map(([url, init]: [string, RequestInit]) => ({
      url,
      init,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    }));
}

describe("Opper.traced", () => {
  const config = { apiKey: "test-key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates a span, runs the callback, and updates the span", async () => {
    const mock = mockFetchSequence([
      // spans.create
      { body: { id: "span-1", trace_id: "trace-1", name: "test" } },
      // spans.update
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    const result = await client.traced("test", async () => "hello");

    expect(result).toBe("hello");
    const calls = getCalls();
    expect(calls).toHaveLength(2);

    // Create span
    expect(calls[0].url).toBe("https://api.test.com/v3/spans");
    expect(calls[0].body.name).toBe("test");
    expect(calls[0].body.start_time).toBeDefined();

    // Update span
    expect(calls[1].url).toBe("https://api.test.com/v3/spans/span-1");
    expect(calls[1].init.method).toBe("PATCH");
    expect(calls[1].body.end_time).toBeDefined();
    expect(calls[1].body.error).toBeUndefined();
  });

  it("defaults name to 'traced' when called with just a function", async () => {
    const mock = mockFetchSequence([
      { body: { id: "span-1", trace_id: "trace-1", name: "traced" } },
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    await client.traced(async () => {});

    const calls = getCalls();
    expect(calls[0].body.name).toBe("traced");
  });

  it("accepts TracedOptions with meta and tags", async () => {
    const mock = mockFetchSequence([
      { body: { id: "span-1", trace_id: "trace-1", name: "custom" } },
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    await client.traced(
      { name: "custom", input: "some input", meta: { userId: "u1" }, tags: { env: "test" } },
      async () => {},
    );

    const calls = getCalls();
    expect(calls[0].body.name).toBe("custom");
    expect(calls[0].body.input).toBe("some input");
    expect(calls[0].body.meta).toEqual({ userId: "u1" });
    expect(calls[0].body.tags).toEqual({ env: "test" });
  });

  it("provides SpanHandle to the callback", async () => {
    const mock = mockFetchSequence([
      { body: { id: "span-42", trace_id: "trace-99", name: "test" } },
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;

    const client = new Opper(config);
    await client.traced("test", async (span) => {
      expect(span.id).toBe("span-42");
      expect(span.traceId).toBe("trace-99");
    });
  });

  it("auto-injects parent_span_id on run() calls inside traced()", async () => {
    const mock = mockFetchSequence([
      // spans.create
      { body: { id: "span-1", trace_id: "trace-1", name: "flow" } },
      // run()
      { body: { output: "result", meta: {} } },
      // spans.update
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    await client.traced("flow", async () => {
      await client.run("my-fn", { input: "hello" });
    });

    const calls = getCalls();
    // The run() call should have parent_span_id injected
    const runCall = calls[1];
    expect(runCall.url).toBe("https://api.test.com/v3/functions/my-fn/run");
    expect(runCall.body.parent_span_id).toBe("span-1");
  });

  it("explicit parent_span_id overrides auto context", async () => {
    const mock = mockFetchSequence([
      { body: { id: "span-1", trace_id: "trace-1", name: "flow" } },
      { body: { output: "result", meta: {} } },
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    await client.traced("flow", async () => {
      await client.run("my-fn", { input: "hello", parent_span_id: "explicit-id" });
    });

    const calls = getCalls();
    const runCall = calls[1];
    expect(runCall.body.parent_span_id).toBe("explicit-id");
  });

  it("nesting creates child spans with correct parent_id", async () => {
    const mock = mockFetchSequence([
      // outer spans.create
      { body: { id: "outer-span", trace_id: "trace-1", name: "outer" } },
      // inner spans.create
      { body: { id: "inner-span", trace_id: "trace-1", name: "inner" } },
      // run() inside inner
      { body: { output: "result", meta: {} } },
      // inner spans.update
      { body: {}, status: 204 },
      // outer spans.update
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    await client.traced("outer", async () => {
      await client.traced("inner", async () => {
        await client.run("my-fn", { input: "hello" });
      });
    });

    const calls = getCalls();

    // Inner span should have parent_id = outer-span and trace_id = trace-1
    const innerCreate = calls[1];
    expect(innerCreate.body.parent_id).toBe("outer-span");
    expect(innerCreate.body.trace_id).toBe("trace-1");

    // run() inside inner should parent to inner-span
    const runCall = calls[2];
    expect(runCall.body.parent_span_id).toBe("inner-span");
  });

  it("updates span with error when callback throws", async () => {
    const mock = mockFetchSequence([
      { body: { id: "span-1", trace_id: "trace-1", name: "fail" } },
      { body: {}, status: 204 },
    ]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    await expect(
      client.traced("fail", async () => {
        throw new Error("something broke");
      }),
    ).rejects.toThrow("something broke");

    const calls = getCalls();
    // Update span should have error and end_time
    const updateCall = calls[1];
    expect(updateCall.body.error).toBe("something broke");
    expect(updateCall.body.end_time).toBeDefined();
  });

  it("run() outside traced() has no parent_span_id", async () => {
    const mock = mockFetchSequence([{ body: { output: "result", meta: {} } }]);
    globalThis.fetch = mock;
    const getCalls = captureFetch(mock);

    const client = new Opper(config);
    await client.run("my-fn", { input: "hello" });

    const calls = getCalls();
    expect(calls[0].body.parent_span_id).toBeUndefined();
  });
});
