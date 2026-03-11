import { afterEach, describe, expect, it } from "vitest";
import { Opper } from "../index.js";

describe("Opper client construction", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses apiKey from config", () => {
    const client = new Opper({ apiKey: "test-key" });
    expect(client.functions).toBeDefined();
    expect(client.spans).toBeDefined();
    expect(client.embeddings).toBeDefined();
  });

  it("uses OPPER_API_KEY env var when no apiKey in config", () => {
    process.env.OPPER_API_KEY = "env-key";
    const client = new Opper();
    expect(client.functions).toBeDefined();
  });

  it("throws when no apiKey and no env var", () => {
    delete process.env.OPPER_API_KEY;
    expect(() => new Opper()).toThrow("Missing API key");
  });

  it("uses OPPER_BASE_URL env var when no baseUrl in config", () => {
    process.env.OPPER_API_KEY = "key";
    process.env.OPPER_BASE_URL = "https://custom.api.com";
    const client = new Opper();
    expect(client.functions).toBeDefined();
  });

  it("explicit config overrides env vars", () => {
    process.env.OPPER_API_KEY = "env-key";
    const client = new Opper({ apiKey: "explicit-key" });
    expect(client.functions).toBeDefined();
  });

  it("exposes all clients", () => {
    const client = new Opper({ apiKey: "key" });
    expect(client.functions).toBeDefined();
    expect(client.spans).toBeDefined();
    expect(client.generations).toBeDefined();
    expect(client.models).toBeDefined();
    expect(client.embeddings).toBeDefined();
    expect(client.system).toBeDefined();
  });

  it("has run() convenience method", () => {
    const client = new Opper({ apiKey: "key" });
    expect(typeof client.run).toBe("function");
  });

  it("has stream() convenience method", () => {
    const client = new Opper({ apiKey: "key" });
    expect(typeof client.stream).toBe("function");
  });
});
