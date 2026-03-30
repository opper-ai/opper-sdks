import { describe, expect, it } from "vitest";
import { BaseClient } from "../client-base.js";

// Expose protected methods for testing
class TestClient extends BaseClient {
  public testBuildQueryString(
    params?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    return this.buildQueryString(params);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getDefaultHeaders(): Record<string, string> {
    return this.defaultHeaders;
  }
}

describe("BaseClient", () => {
  describe("construction", () => {
    it("uses default base URL when not provided", () => {
      const client = new TestClient({ apiKey: "test-key" });
      expect(client.getBaseUrl()).toBe("https://api.opper.ai");
    });

    it("uses provided base URL", () => {
      const client = new TestClient({ apiKey: "test-key", baseUrl: "https://custom.api.com" });
      expect(client.getBaseUrl()).toBe("https://custom.api.com");
    });

    it("strips trailing slashes from base URL", () => {
      const client = new TestClient({ apiKey: "test-key", baseUrl: "https://custom.api.com///" });
      expect(client.getBaseUrl()).toBe("https://custom.api.com");
    });

    it("sets Authorization header with Bearer token", () => {
      const client = new TestClient({ apiKey: "my-api-key" });
      const headers = client.getDefaultHeaders();
      expect(headers.Authorization).toBe("Bearer my-api-key");
    });

    it("sets Content-Type and Accept headers", () => {
      const client = new TestClient({ apiKey: "key" });
      const headers = client.getDefaultHeaders();
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Accept).toBe("application/json");
    });

    it("merges custom headers", () => {
      const client = new TestClient({
        apiKey: "key",
        headers: { "X-Custom": "value" },
      });
      const headers = client.getDefaultHeaders();
      expect(headers["X-Custom"]).toBe("value");
      expect(headers.Authorization).toBe("Bearer key");
    });

    it("custom headers override defaults", () => {
      const client = new TestClient({
        apiKey: "key",
        headers: { Accept: "text/plain" },
      });
      const headers = client.getDefaultHeaders();
      expect(headers.Accept).toBe("text/plain");
    });
  });

  describe("buildQueryString", () => {
    it("returns empty string for undefined params", () => {
      const client = new TestClient({ apiKey: "key" });
      expect(client.testBuildQueryString()).toBe("");
    });

    it("returns empty string for empty params", () => {
      const client = new TestClient({ apiKey: "key" });
      expect(client.testBuildQueryString({})).toBe("");
    });

    it("builds query string from params", () => {
      const client = new TestClient({ apiKey: "key" });
      const qs = client.testBuildQueryString({ page: 1, size: 10 });
      expect(qs).toBe("?page=1&size=10");
    });

    it("omits undefined and null values", () => {
      const client = new TestClient({ apiKey: "key" });
      const qs = client.testBuildQueryString({ a: "yes", b: undefined, c: null, d: "ok" });
      expect(qs).toBe("?a=yes&d=ok");
    });

    it("encodes special characters", () => {
      const client = new TestClient({ apiKey: "key" });
      const qs = client.testBuildQueryString({ q: "hello world" });
      expect(qs).toBe("?q=hello%20world");
    });

    it("handles boolean values", () => {
      const client = new TestClient({ apiKey: "key" });
      const qs = client.testBuildQueryString({ active: true });
      expect(qs).toBe("?active=true");
    });
  });
});
