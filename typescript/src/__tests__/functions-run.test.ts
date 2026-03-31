import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsClient } from "../clients/functions.js";
import { ApiError } from "../types.js";

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "content-length": "100" }),
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("FunctionsClient.run", () => {
  const config = { apiKey: "test-key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to /v3/functions/{name}/call", async () => {
    const fetchMock = mockFetch({ data: "hello", meta: {} });
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.run("my-fn", {
      input_schema: {},
      output_schema: {},
      input: { q: "test" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/call");
    expect(init.method).toBe("POST");
  });

  it("encodes function name in URL", async () => {
    const fetchMock = mockFetch({ data: null });
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.run("my fn/special", {
      input_schema: {},
      output_schema: {},
      input: {},
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my%20fn%2Fspecial/call");
  });

  it("parses RunResponse correctly", async () => {
    const fetchMock = mockFetch({
      data: { answer: "42" },
      meta: { function_name: "test", execution_ms: 100, llm_calls: 1 },
    });
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const result = await client.run("test", {
      input_schema: {},
      output_schema: {},
      input: {},
    });

    expect(result.data).toEqual({ answer: "42" });
    expect(result.meta?.function_name).toBe("test");
    expect(result.meta?.execution_ms).toBe(100);
  });

  it("sends request body as JSON", async () => {
    const fetchMock = mockFetch({ data: null });
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const body = {
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      input: { question: "hello" },
      model: "anthropic/claude-sonnet-4-6",
      temperature: 0.5,
    };
    await client.run("fn", body);

    const [, init] = fetchMock.mock.calls[0];
    const parsed = JSON.parse(init.body as string);
    expect(parsed.input).toEqual({ question: "hello" });
    expect(parsed.model).toBe("anthropic/claude-sonnet-4-6");
    expect(parsed.temperature).toBe(0.5);
  });

  it("throws ApiError on non-2xx response", async () => {
    const fetchMock = mockFetch({ error: { message: "not found" } }, 404);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await expect(
      client.run("missing", { input_schema: {}, output_schema: {}, input: {} }),
    ).rejects.toThrow(ApiError);
  });

  it("includes Authorization header", async () => {
    const fetchMock = mockFetch({ data: null });
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.run("fn", { input_schema: {}, output_schema: {}, input: {} });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });
});
