import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsClient } from "../clients/functions.js";

function mockFetch(response: object | undefined, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 204 ? "No Content" : "Error",
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

// ═══════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════

describe("FunctionsClient CRUD", () => {
  it("list sends GET to /v3/functions", async () => {
    const resp = { functions: [{ name: "fn-1" }] };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const result = await client.list();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions");
    expect(init.method).toBe("GET");
    expect(result).toHaveLength(1);
  });

  it("get sends GET to /v3/functions/{name}", async () => {
    const resp = { name: "my-fn", script: "code" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const result = await client.get("my-fn");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn");
    expect(result.name).toBe("my-fn");
  });

  it("get encodes special characters in name", async () => {
    globalThis.fetch = mockFetch({ name: "my fn" });

    const client = new FunctionsClient(config);
    await client.get("my fn");

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my%20fn");
  });

  it("update sends PUT to /v3/functions/{name}", async () => {
    const resp = { name: "my-fn", script: "new code" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.update("my-fn", { source: "new code" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body).source).toBe("new code");
  });

  it("delete sends DELETE to /v3/functions/{name}", async () => {
    const fetchMock = mockFetch(undefined, 204);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.delete("my-fn");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn");
    expect(init.method).toBe("DELETE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Realtime
// ═══════════════════════════════════════════════════════════════════════════

describe("FunctionsClient realtime", () => {
  it("createRealtime sends POST to /v3/functions/{name}/realtime", async () => {
    const resp = { session_id: "s-1" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.createRealtime("voice-fn", {
      instructions: "Be helpful",
      model: "openai/gpt-4o-realtime",
      voice: "alloy",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/voice-fn/realtime");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).instructions).toBe("Be helpful");
  });

  it("getRealtimeWebSocketUrl converts http to ws", () => {
    const client = new FunctionsClient(config);
    const url = client.getRealtimeWebSocketUrl("voice-fn");
    expect(url).toBe("wss://api.test.com/v3/realtime/voice-fn");
  });

  it("getRealtimeWebSocketUrl encodes name", () => {
    const client = new FunctionsClient(config);
    const url = client.getRealtimeWebSocketUrl("my fn");
    expect(url).toBe("wss://api.test.com/v3/realtime/my%20fn");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Revisions
// ═══════════════════════════════════════════════════════════════════════════

describe("FunctionsClient revisions", () => {
  it("listRevisions sends GET to /v3/functions/{name}/revisions", async () => {
    const resp = { revisions: [{ id: 1, created_at: "2025-01-01" }] };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    const result = await client.listRevisions("my-fn");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/revisions");
    expect(init.method).toBe("GET");
    expect(result).toHaveLength(1);
  });

  it("getRevision sends GET to /v3/functions/{name}/revisions/{id}", async () => {
    const resp = { id: 3, script: "code v3" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.getRevision("my-fn", 3);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/revisions/3");
  });

  it("revertRevision sends POST to /v3/functions/{name}/revisions/{id}/revert", async () => {
    const resp = { name: "my-fn", script: "code v1" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new FunctionsClient(config);
    await client.revertRevision("my-fn", 1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/functions/my-fn/revisions/1/revert");
    expect(init.method).toBe("POST");
  });
});
