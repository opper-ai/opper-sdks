import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponsesClient } from "../clients/responses.js";

function mockFetch(response: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-length": "100" }),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("ResponsesClient", () => {
  const config = { apiKey: "key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to /v3/compat/responses", async () => {
    const fetchMock = mockFetch({ id: "1", output: [] });
    globalThis.fetch = fetchMock;

    const client = new ResponsesClient(config);
    await client.create({ input: "hello" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/compat/responses");
  });

  it("sets stream: false for non-streaming", async () => {
    const fetchMock = mockFetch({ id: "1", output: [] });
    globalThis.fetch = fetchMock;

    const client = new ResponsesClient(config);
    await client.create({ input: "hello" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stream).toBe(false);
  });
});
