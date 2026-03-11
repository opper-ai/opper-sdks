import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsClient } from "../clients/functions.js";

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers({ "content-length": "100" }),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("FunctionsClient examples", () => {
  const config = { apiKey: "key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("createExample sends POST to /v3/functions/{name}/examples", async () => {
    const fetchMock = mockFetch({ uuid: "ex-1", input: {}, output: {} });
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.createExample("my-fn", { input: { q: "hi" }, output: { a: "hello" } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/examples");
    expect(init.method).toBe("POST");
  });

  it("createExamplesBatch sends POST to /v3/functions/{name}/examples/batch", async () => {
    const fetchMock = mockFetch([]);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.createExamplesBatch("my-fn", [
      { input: { q: "1" }, output: { a: "1" } },
      { input: { q: "2" }, output: { a: "2" } },
    ]);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/examples/batch");
  });

  it("listExamples sends GET to /v3/functions/{name}/examples", async () => {
    const fetchMock = mockFetch({ examples: [] });
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.listExamples("my-fn", { limit: 10, tag: "train" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/examples?limit=10&tag=train");
    expect(init.method).toBe("GET");
  });

  it("deleteExample sends DELETE to /v3/functions/{name}/examples/{uuid}", async () => {
    const fetchMock = mockFetch({}, 204);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.deleteExample("my-fn", "uuid-123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/examples/uuid-123");
    expect(init.method).toBe("DELETE");
  });
});
