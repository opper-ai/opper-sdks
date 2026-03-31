import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeClient } from "../clients/knowledge.js";

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

describe("KnowledgeClient", () => {
  const config = { apiKey: "test-key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── CRUD ─────────────────────────────────────────────────────────────────

  it("create sends POST to /v2/knowledge", async () => {
    const body = { name: "my-kb" };
    const resp = { id: "kb-1", name: "my-kb" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    const result = await client.create(body);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(body);
    expect(result).toEqual(resp);
  });

  it("list sends GET to /v2/knowledge with pagination", async () => {
    const resp = { data: [], total: 0 };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.list({ offset: 10, limit: 5 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge?offset=10&limit=5");
    expect(init.method).toBe("GET");
  });

  it("getById sends GET to /v2/knowledge/{id}", async () => {
    const resp = { id: "kb-1", name: "test" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.getById("kb-1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1");
  });

  it("getByName sends GET with encoded name", async () => {
    const resp = { id: "kb-1", name: "my kb" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.getByName("my kb");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/by-name/my%20kb");
  });

  it("delete sends DELETE to /v2/knowledge/{id}", async () => {
    const fetchMock = mockFetch(undefined, 204);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.delete("kb-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1");
    expect(init.method).toBe("DELETE");
  });

  // ── Documents ────────────────────────────────────────────────────────────

  it("add sends POST to /v2/knowledge/{id}/add", async () => {
    const resp = { id: "doc-1" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.add("kb-1", { content: "hello world" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/add");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).content).toBe("hello world");
  });

  it("query sends POST to /v2/knowledge/{id}/query", async () => {
    const resp = [{ content: "result", score: 0.9 }];
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    const results = await client.query("kb-1", { query: "search term", top_k: 5 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/query");
    expect(init.method).toBe("POST");
    expect(results).toEqual(resp);
  });

  it("getDocument sends GET with encoded document key", async () => {
    const resp = { key: "doc/key", content: "text" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.getDocument("kb-1", "doc/key");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/documents/doc%2Fkey");
  });

  it("deleteDocuments sends DELETE to /v2/knowledge/{id}/query", async () => {
    const resp = { deleted: 3 };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.deleteDocuments("kb-1", { filters: [{ field: "source", operation: "=", value: "test" }] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/query");
    expect(init.method).toBe("DELETE");
  });

  // ── Files ────────────────────────────────────────────────────────────────

  it("getUploadUrl sends GET with filename", async () => {
    const resp = { url: "https://s3.example.com/upload", file_id: "f-1" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.getUploadUrl("kb-1", "doc.pdf");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/upload_url?filename=doc.pdf");
  });

  it("registerFileUpload sends POST to /v2/knowledge/{id}/register_file", async () => {
    const resp = { file_id: "f-1", status: "processing" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.registerFileUpload("kb-1", { file_id: "f-1", filename: "doc.pdf", content_type: "application/pdf" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/register_file");
    expect(init.method).toBe("POST");
  });

  it("listFiles sends GET with pagination", async () => {
    const resp = { data: [], total: 0 };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.listFiles("kb-1", { offset: 0, limit: 10 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/files?offset=0&limit=10");
  });

  it("getFileDownloadUrl sends GET to correct path", async () => {
    const resp = { url: "https://s3.example.com/download" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.getFileDownloadUrl("kb-1", "f-1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/files/f-1/download_url");
  });

  it("deleteFile sends DELETE to correct path", async () => {
    const fetchMock = mockFetch(undefined, 204);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    await client.deleteFile("kb-1", "f-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/files/f-1");
    expect(init.method).toBe("DELETE");
  });

  it("uploadFile sends multipart POST", async () => {
    const resp = { file_id: "f-1" };
    const fetchMock = mockFetch(resp);
    globalThis.fetch = fetchMock;

    const client = new KnowledgeClient(config);
    const blob = new Blob(["file content"], { type: "text/plain" });
    await client.uploadFile("kb-1", blob, {
      filename: "test.txt",
      chunkSize: 500,
      chunkOverlap: 50,
      metadata: { source: "test" },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.com/v2/knowledge/kb-1/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // Content-Type should not be set (let fetch set multipart boundary)
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});
