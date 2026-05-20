import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "../clients/realtime.js";

function mockFetch(response: object | undefined, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({
      "content-length": response ? String(JSON.stringify(response).length) : "0",
    }),
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(response ? JSON.stringify(response) : ""),
  });
}

const config = { apiKey: "test-key", baseUrl: "https://api.test.com" };
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("RealtimeClient.url", () => {
  it("converts https → wss and appends /v3/realtime", () => {
    const client = new RealtimeClient(config);
    expect(client.url()).toBe("wss://api.test.com/v3/realtime");
  });

  it("converts http → ws for local dev", () => {
    const client = new RealtimeClient({ apiKey: "k", baseUrl: "http://localhost:8000" });
    expect(client.url()).toBe("ws://localhost:8000/v3/realtime");
  });

  it("appends ticket as query parameter when provided", () => {
    const client = new RealtimeClient(config);
    expect(client.url({ ticket: "abc-def" })).toBe(
      "wss://api.test.com/v3/realtime?ticket=abc-def",
    );
  });

  it("URL-encodes ticket values", () => {
    const client = new RealtimeClient(config);
    expect(client.url({ ticket: "a b/c=d" })).toBe(
      "wss://api.test.com/v3/realtime?ticket=a%20b%2Fc%3Dd",
    );
  });
});

describe("RealtimeClient.createSession", () => {
  it("POSTs to /v3/realtime-sessions and returns the ticket", async () => {
    const resp = {
      client_secret: "secret-123",
      expires_at: "2026-01-01T00:00:00Z",
    };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new RealtimeClient(config);
    const session = await client.createSession({
      config: {
        model: "openai/gpt-realtime-2",
        voice: "marin",
        instructions: "Be helpful",
      },
      ttl_seconds: 60,
    });

    expect(session.client_secret).toBe("secret-123");
    expect(session.expires_at).toBe("2026-01-01T00:00:00Z");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/realtime-sessions");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.config.model).toBe("openai/gpt-realtime-2");
    expect(body.ttl_seconds).toBe(60);
  });

  it("forwards locked_fields when provided", async () => {
    const fetchMock = mockFetch({ client_secret: "s", expires_at: "t" });
    globalThis.fetch = fetchMock;

    const client = new RealtimeClient(config);
    await client.createSession({
      config: { model: "openai/gpt-realtime-2" },
      locked_fields: ["output_transcription"],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.locked_fields).toEqual(["output_transcription"]);
  });
});
