import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddingsClient } from "../clients/embeddings.js";

function mockFetch(response: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-length": "100" }),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

describe("EmbeddingsClient", () => {
  const config = { apiKey: "key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST to /v3/compat/embeddings", async () => {
    const fetchMock = mockFetch({ object: "list", data: [], model: "m", usage: {} });
    globalThis.fetch = fetchMock;

    const client = new EmbeddingsClient(config);
    await client.createEmbedding({ input: "hello", model: "text-embedding-3-small" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/compat/embeddings");
  });
});
