import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TracesClient } from "../clients/traces.js";
import { GenerationsClient } from "../clients/generations.js";
import { ModelsClient } from "../clients/models.js";
import { SystemClient } from "../clients/system.js";
import { WebToolsClient } from "../clients/web-tools.js";

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
// TracesClient
// ═══════════════════════════════════════════════════════════════════════════

describe("TracesClient", () => {
  it("listTraces sends GET to /v3/traces", async () => {
    const resp = { data: [], total: 0 };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new TracesClient(config);
    await client.listTraces({ limit: 10, offset: 0, name: "my-trace" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/traces?limit=10&offset=0&name=my-trace");
    expect(init.method).toBe("GET");
  });

  it("listTraces works without params", async () => {
    const resp = { data: [], total: 0 };
    globalThis.fetch = mockFetch(resp);

    const client = new TracesClient(config);
    await client.listTraces();

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/traces");
  });

  it("getTrace sends GET to /v3/traces/{id} and unwraps data", async () => {
    const trace = { id: "t-1", name: "test", spans: [] };
    const fetchMock = mockFetch({ data: trace });
    globalThis.fetch = fetchMock;

    const client = new TracesClient(config);
    const result = await client.getTrace("t-1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/traces/t-1");
    expect(result).toEqual(trace);
  });

  it("getTrace encodes id", async () => {
    globalThis.fetch = mockFetch({ data: {} });

    const client = new TracesClient(config);
    await client.getTrace("trace/special");

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/traces/trace%2Fspecial");
  });

  it("deleteTrace sends DELETE to /v3/traces/{id}", async () => {
    const fetchMock = mockFetch(undefined, 204);
    globalThis.fetch = fetchMock;

    const client = new TracesClient(config);
    await client.deleteTrace("t-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/traces/t-1");
    expect(init.method).toBe("DELETE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GenerationsClient
// ═══════════════════════════════════════════════════════════════════════════

describe("GenerationsClient", () => {
  it("listGenerations sends GET to /v3/generations with params", async () => {
    const resp = { data: [], meta: { page: 1, page_size: 50, total: 0, total_pages: 0 } };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new GenerationsClient(config);
    await client.listGenerations({ query: "test", page: 2, page_size: 10 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/generations?query=test&page=2&page_size=10");
    expect(init.method).toBe("GET");
  });

  it("listGenerations works without params", async () => {
    const resp = { data: [], meta: { page: 1, page_size: 50, total: 0, total_pages: 0 } };
    globalThis.fetch = mockFetch(resp);

    const client = new GenerationsClient(config);
    await client.listGenerations();

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/generations");
  });

  it("getGeneration sends GET to /v3/generations/{id}", async () => {
    const gen = { id: "g-1", function_name: "test", input: {}, output: {}, created_at: "2025-01-01" };
    const fetchMock = mockFetch(gen);
    globalThis.fetch = fetchMock;

    const client = new GenerationsClient(config);
    const result = await client.getGeneration("g-1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/generations/g-1");
    expect(result).toEqual(gen);
  });

  it("deleteGeneration sends DELETE to /v3/generations/{id}", async () => {
    const resp = { deleted: true };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new GenerationsClient(config);
    const result = await client.deleteGeneration("g-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/generations/g-1");
    expect(init.method).toBe("DELETE");
    expect(result.deleted).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ModelsClient
// ═══════════════════════════════════════════════════════════════════════════

describe("ModelsClient", () => {
  it("list sends GET to /v3/models", async () => {
    const resp = { data: [] };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new ModelsClient(config);
    await client.list();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/models");
    expect(init.method).toBe("GET");
  });

  it("list passes filter params", async () => {
    globalThis.fetch = mockFetch({ data: [] });

    const client = new ModelsClient(config);
    await client.list({
      type: "llm",
      provider: "openai",
      q: "gpt",
      capability: ["vision", "tools"],
      deprecated: true,
      sort: "id",
      order: "desc",
      limit: 10,
      offset: 5,
    });

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toContain("type=llm");
    expect(url).toContain("provider=openai");
    expect(url).toContain("q=gpt");
    expect(url).toContain("capability=vision%2Ctools");
    expect(url).toContain("deprecated=true");
    expect(url).toContain("sort=id");
    expect(url).toContain("order=desc");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("list handles single capability string", async () => {
    globalThis.fetch = mockFetch({ data: [] });

    const client = new ModelsClient(config);
    await client.list({ capability: "vision" });

    const [url] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toContain("capability=vision");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SystemClient
// ═══════════════════════════════════════════════════════════════════════════

describe("SystemClient", () => {
  it("healthCheck sends GET to /health", async () => {
    const resp = { status: "ok" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new SystemClient(config);
    const result = await client.healthCheck();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/health");
    expect(init.method).toBe("GET");
    expect(result.status).toBe("ok");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WebToolsClient
// ═══════════════════════════════════════════════════════════════════════════

describe("WebToolsClient", () => {
  it("fetch sends POST to /v3/tools/web/fetch", async () => {
    const resp = { content: "# Title\nBody text", url: "https://example.com" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new WebToolsClient(config);
    const result = await client.fetch({ url: "https://example.com" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/tools/web/fetch");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).url).toBe("https://example.com");
    expect(result.content).toBe("# Title\nBody text");
  });

  it("search sends POST to /v3/tools/web/search", async () => {
    const resp = { results: [{ title: "Result", url: "https://example.com", snippet: "..." }] };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new WebToolsClient(config);
    const result = await client.search({ query: "test query" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v3/tools/web/search");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).query).toBe("test query");
    expect(result.results).toHaveLength(1);
  });
});
