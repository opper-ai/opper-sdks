// Embeddings via the embed() builtin
// Generate vector embeddings for text, useful for semantic search and similarity.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── Single text embedding ───────────────────────────────────────────────────

const result = await opper.call("sdk-test-embed", {
  input_schema: z.object({
    text: z.string().describe("Text to generate an embedding for"),
  }),
  output_schema: z.object({
    embedding: z.array(z.number()).describe("Vector embedding of the input text"),
  }),
  input: {
    text: "The quick brown fox jumps over the lazy dog",
  },
});

console.log("── Single embedding ──");
console.log("Dimensions:", result.data.embedding.length);
console.log("First 5 values:", result.data.embedding.slice(0, 5));

// ── Compare similarity between two texts ────────────────────────────────────

const a = await opper.call("sdk-test-embed", {
  input_schema: z.object({ text: z.string().describe("Text to embed") }),
  output_schema: z.object({ embedding: z.array(z.number()).describe("Vector embedding") }),
  input: { text: "I love programming in TypeScript" },
});

const b = await opper.call("sdk-test-embed", {
  input_schema: z.object({ text: z.string().describe("Text to embed") }),
  output_schema: z.object({ embedding: z.array(z.number()).describe("Vector embedding") }),
  input: { text: "TypeScript is my favorite language for coding" },
});

const c = await opper.call("sdk-test-embed", {
  input_schema: z.object({ text: z.string().describe("Text to embed") }),
  output_schema: z.object({ embedding: z.array(z.number()).describe("Vector embedding") }),
  input: { text: "The weather in Stockholm is cold today" },
});

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

console.log("\n── Similarity comparison ──");
console.log("Similar texts:", cosineSimilarity(a.data.embedding, b.data.embedding).toFixed(4));
console.log("Unrelated texts:", cosineSimilarity(a.data.embedding, c.data.embedding).toFixed(4));
