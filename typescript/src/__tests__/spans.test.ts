import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpansClient } from "../clients/spans.js";

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers({ "content-length": String(JSON.stringify(response).length) }),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("SpansClient", () => {
  const config = { apiKey: "key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to /v3/spans for create", async () => {
    const fetchMock = mockFetch({ data: { id: "span-1", trace_id: "trace-1", name: "test" } });
    globalThis.fetch = fetchMock;

    const client = new SpansClient(config);
    const result = await client.create({ name: "test-span" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/spans");
    expect(init.method).toBe("POST");
    expect(result.id).toBe("span-1");
  });

  it("sends PATCH to /v3/spans/{id} for update", async () => {
    const fetchMock = mockFetch({}, 204);
    globalThis.fetch = fetchMock;

    const client = new SpansClient(config);
    await client.update("span-1", { output: "done" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/spans/span-1");
    expect(init.method).toBe("PATCH");
  });

  it("sends request body for create", async () => {
    const fetchMock = mockFetch({ data: { id: "s", trace_id: "t", name: "n" } });
    globalThis.fetch = fetchMock;

    const client = new SpansClient(config);
    await client.create({ name: "my-span", trace_id: "trace-123", input: "hello" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.name).toBe("my-span");
    expect(body.trace_id).toBe("trace-123");
    expect(body.input).toBe("hello");
  });
});
