import { describe, expect, it } from "vitest";
import { Opper } from "../index.js";

/**
 * Verifies that every endpoint in BASE_CLIENT_SPEC.md §3 has a corresponding
 * method on the Opper client. This is a completeness test.
 */
describe("Spec endpoint coverage", () => {
  const client = new Opper({ apiKey: "test-key" });

  // CORE (Functions)
  it("POST /v3/functions/{name}/run → client.functions.runFunction", () => {
    expect(typeof client.functions.runFunction).toBe("function");
  });

  it("POST /v3/functions/{name}/stream → client.functions.streamFunction", () => {
    expect(typeof client.functions.streamFunction).toBe("function");
  });

  it("GET /v3/functions → client.functions.listFunctions", () => {
    expect(typeof client.functions.listFunctions).toBe("function");
  });

  it("GET /v3/functions/{name} → client.functions.getFunction", () => {
    expect(typeof client.functions.getFunction).toBe("function");
  });

  it("PUT /v3/functions/{name} → client.functions.updateFunction", () => {
    expect(typeof client.functions.updateFunction).toBe("function");
  });

  it("DELETE /v3/functions/{name} → client.functions.deleteFunction", () => {
    expect(typeof client.functions.deleteFunction).toBe("function");
  });

  it("POST /v3/functions/{name}/realtime → client.functions.createRealtimeFunction", () => {
    expect(typeof client.functions.createRealtimeFunction).toBe("function");
  });

  it("GET /v3/functions/{name}/revisions → client.functions.listRevisions", () => {
    expect(typeof client.functions.listRevisions).toBe("function");
  });

  it("GET /v3/functions/{name}/revisions/{id} → client.functions.getRevision", () => {
    expect(typeof client.functions.getRevision).toBe("function");
  });

  it("POST /v3/functions/{name}/revisions/{id}/revert → client.functions.revertRevision", () => {
    expect(typeof client.functions.revertRevision).toBe("function");
  });

  // CORE (Examples)
  it("POST /v3/functions/{name}/examples → client.functions.createExample", () => {
    expect(typeof client.functions.createExample).toBe("function");
  });

  it("POST /v3/functions/{name}/examples/batch → client.functions.createExamplesBatch", () => {
    expect(typeof client.functions.createExamplesBatch).toBe("function");
  });

  it("GET /v3/functions/{name}/examples → client.functions.listExamples", () => {
    expect(typeof client.functions.listExamples).toBe("function");
  });

  it("DELETE /v3/functions/{name}/examples/{uuid} → client.functions.deleteExample", () => {
    expect(typeof client.functions.deleteExample).toBe("function");
  });

  // WebSocket URL helper
  it("WS /v3/realtime/{name} → client.functions.getRealtimeWebSocketUrl", () => {
    expect(typeof client.functions.getRealtimeWebSocketUrl).toBe("function");
  });

  // OBSERVABILITY
  it("POST /v3/spans → client.spans.create", () => {
    expect(typeof client.spans.create).toBe("function");
  });

  it("PATCH /v3/spans/{id} → client.spans.update", () => {
    expect(typeof client.spans.update).toBe("function");
  });

  it("GET /v3/generations → client.generations.listGenerations", () => {
    expect(typeof client.generations.listGenerations).toBe("function");
  });

  it("GET /v3/generations/{id} → client.generations.getGeneration", () => {
    expect(typeof client.generations.getGeneration).toBe("function");
  });

  it("DELETE /v3/generations/{id} → client.generations.deleteGeneration", () => {
    expect(typeof client.generations.deleteGeneration).toBe("function");
  });

  // COMPATIBILITY
  it("POST /v3/compat/chat/completions → client.compat.chat.createCompletion", () => {
    expect(typeof client.compat.chat.createCompletion).toBe("function");
  });

  it("POST /v3/compat/chat/completions (stream) → client.compat.chat.streamCompletion", () => {
    expect(typeof client.compat.chat.streamCompletion).toBe("function");
  });

  it("POST /v3/compat/responses → client.compat.responses.create", () => {
    expect(typeof client.compat.responses.create).toBe("function");
  });

  it("POST /v3/compat/responses (stream) → client.compat.responses.createStream", () => {
    expect(typeof client.compat.responses.createStream).toBe("function");
  });

  it("POST /v3/compat/v1beta/interactions → client.compat.interactions.generateContent", () => {
    expect(typeof client.compat.interactions.generateContent).toBe("function");
  });

  it("POST /v3/compat/v1beta/interactions (stream) → client.compat.interactions.streamGenerateContent", () => {
    expect(typeof client.compat.interactions.streamGenerateContent).toBe("function");
  });

  it("POST /v3/compat/v1/messages → client.compat.messages.create", () => {
    expect(typeof client.compat.messages.create).toBe("function");
  });

  it("POST /v3/compat/v1/messages (stream) → client.compat.messages.createStream", () => {
    expect(typeof client.compat.messages.createStream).toBe("function");
  });

  it("POST /v3/compat/embeddings → client.compat.embeddings.createEmbedding", () => {
    expect(typeof client.compat.embeddings.createEmbedding).toBe("function");
  });

  // UTILITY
  it("GET /v3/models → client.models.listModels", () => {
    expect(typeof client.models.listModels).toBe("function");
  });

  it("POST /v3/parse → client.parse.parseStarlark", () => {
    expect(typeof client.parse.parseStarlark).toBe("function");
  });

  it("GET /health → client.system.healthCheck", () => {
    expect(typeof client.system.healthCheck).toBe("function");
  });

  // Convenience methods
  it("client.run() convenience method", () => {
    expect(typeof client.run).toBe("function");
  });

  it("client.stream() convenience method", () => {
    expect(typeof client.stream).toBe("function");
  });
});
