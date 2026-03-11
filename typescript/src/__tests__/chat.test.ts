import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatClient } from "../clients/chat.js";

function mockFetch(response: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-length": "100" }),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("ChatClient", () => {
  const config = { apiKey: "key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to /v3/compat/chat/completions", async () => {
    const fetchMock = mockFetch({ id: "1", choices: [] });
    globalThis.fetch = fetchMock;

    const client = new ChatClient(config);
    await client.createCompletion({ messages: [{ role: "user", content: "hi" }] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/compat/chat/completions");
    expect(init.method).toBe("POST");
  });

  it("sets stream: false for non-streaming requests", async () => {
    const fetchMock = mockFetch({ id: "1", choices: [] });
    globalThis.fetch = fetchMock;

    const client = new ChatClient(config);
    await client.createCompletion({ messages: [{ role: "user", content: "hi" }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stream).toBe(false);
  });
});
