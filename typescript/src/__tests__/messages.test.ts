import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesClient } from "../clients/messages.js";

function mockFetch(response: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-length": "100" }),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("MessagesClient", () => {
  const config = { apiKey: "key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to /v3/compat/v1/messages", async () => {
    const fetchMock = mockFetch({ id: "1", content: [] });
    globalThis.fetch = fetchMock;

    const client = new MessagesClient(config);
    await client.create({
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 100,
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/compat/v1/messages");
  });

  it("sets stream: false for non-streaming", async () => {
    const fetchMock = mockFetch({ id: "1", content: [] });
    globalThis.fetch = fetchMock;

    const client = new MessagesClient(config);
    await client.create({ messages: [{ role: "user", content: "hi" }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stream).toBe(false);
  });
});
