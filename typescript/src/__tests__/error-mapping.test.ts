import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseClient } from "../client-base.js";
import {
  ApiError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
} from "../types.js";

// Expose fetchRaw for testing
class TestClient extends BaseClient {
  async doFetch(url: string): Promise<Response> {
    return this.fetchRaw(url, { method: "GET" });
  }
}

function mockResponse(status: number, statusText: string, body?: object) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ "content-length": "100" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(body ? JSON.stringify(body) : ""),
  });
}

describe("BaseClient error status mapping", () => {
  const config = { apiKey: "test-key", baseUrl: "https://api.test.com" };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws BadRequestError for 400", async () => {
    const body = { error: { code: "invalid_input", message: "bad field" } };
    globalThis.fetch = mockResponse(400, "Bad Request", body);

    const client = new TestClient(config);
    await expect(client.doFetch("/test")).rejects.toThrow(BadRequestError);

    try {
      await client.doFetch("/test");
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestError);
      expect(e).toBeInstanceOf(ApiError);
      expect((e as BadRequestError).status).toBe(400);
      expect((e as BadRequestError).error?.code).toBe("invalid_input");
    }
  });

  it("throws AuthenticationError for 401", async () => {
    globalThis.fetch = mockResponse(401, "Unauthorized");

    const client = new TestClient(config);
    await expect(client.doFetch("/test")).rejects.toThrow(AuthenticationError);

    try {
      await client.doFetch("/test");
    } catch (e) {
      expect((e as AuthenticationError).status).toBe(401);
    }
  });

  it("throws NotFoundError for 404", async () => {
    const body = { error: { code: "not_found", message: "resource not found" } };
    globalThis.fetch = mockResponse(404, "Not Found", body);

    const client = new TestClient(config);
    await expect(client.doFetch("/test")).rejects.toThrow(NotFoundError);

    try {
      await client.doFetch("/test");
    } catch (e) {
      expect((e as NotFoundError).status).toBe(404);
      expect((e as NotFoundError).error?.message).toBe("resource not found");
    }
  });

  it("throws RateLimitError for 429", async () => {
    const body = { error: { code: "rate_limit", message: "slow down" } };
    globalThis.fetch = mockResponse(429, "Too Many Requests", body);

    const client = new TestClient(config);
    await expect(client.doFetch("/test")).rejects.toThrow(RateLimitError);

    try {
      await client.doFetch("/test");
    } catch (e) {
      expect((e as RateLimitError).status).toBe(429);
    }
  });

  it("throws InternalServerError for 500", async () => {
    const body = { error: { code: "internal", message: "something broke" } };
    globalThis.fetch = mockResponse(500, "Internal Server Error", body);

    const client = new TestClient(config);
    await expect(client.doFetch("/test")).rejects.toThrow(InternalServerError);

    try {
      await client.doFetch("/test");
    } catch (e) {
      expect((e as InternalServerError).status).toBe(500);
    }
  });

  it("throws generic ApiError for unmapped status codes", async () => {
    globalThis.fetch = mockResponse(503, "Service Unavailable");

    const client = new TestClient(config);
    await expect(client.doFetch("/test")).rejects.toThrow(ApiError);

    try {
      await client.doFetch("/test");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).not.toBeInstanceOf(BadRequestError);
      expect(e).not.toBeInstanceOf(InternalServerError);
      expect((e as ApiError).status).toBe(503);
    }
  });

  it("handles non-JSON error bodies gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: new Headers(),
      json: () => Promise.reject(new Error("not json")),
      text: () => Promise.resolve("plain text error"),
    });

    const client = new TestClient(config);
    try {
      await client.doFetch("/test");
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestError);
      expect((e as BadRequestError).body).toBe("plain text error");
      expect((e as BadRequestError).error).toBeUndefined();
    }
  });
});
