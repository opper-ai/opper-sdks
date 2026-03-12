// Structured output — four approaches, same result
import { z } from "zod";
import { jsonSchema, Opper } from "../../src/index.js";

const client = new Opper();

const input = {
  text: "Marie Curie conducted groundbreaking research on radioactivity in Paris. She was the first woman to win a Nobel Prize.",
};

const input_schema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
};

// ---------------------------------------------------------------------------
// 1. Zod schema — type-safe, single source of truth (recommended)
// ---------------------------------------------------------------------------

const zodResult = await client.run("sdk-test-extract-entities", {
  output: z.object({
    people: z.array(z.object({ name: z.string(), role: z.string().optional() })),
    locations: z.array(z.string()),
  }),
  input_schema,
  input,
});

console.log("[Zod] People:", zodResult.output.people); // typed!
console.log("[Zod] Locations:", zodResult.output.locations); // typed!

// ---------------------------------------------------------------------------
// 2. jsonSchema() helper — raw JSON Schema wrapped in Standard Schema
//    Gives you the same `output` overload with manual type annotation.
// ---------------------------------------------------------------------------

interface ExtractedEntities {
  people: { name: string; role?: string }[];
  locations: string[];
}

const jsonSchemaResult = await client.run("sdk-test-extract-entities", {
  output: jsonSchema<ExtractedEntities>({
    type: "object",
    properties: {
      people: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, role: { type: "string" } },
          required: ["name"],
        },
      },
      locations: { type: "array", items: { type: "string" } },
    },
    required: ["people", "locations"],
  }),
  input_schema,
  input,
});

console.log("[jsonSchema] People:", jsonSchemaResult.output.people); // typed!
console.log("[jsonSchema] Locations:", jsonSchemaResult.output.locations); // typed!

// ---------------------------------------------------------------------------
// 3. Raw output_schema + generic — escape hatch, no extra deps
// ---------------------------------------------------------------------------

const rawResult = await client.run<ExtractedEntities>("sdk-test-extract-entities", {
  input_schema,
  output_schema: {
    type: "object",
    properties: {
      people: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, role: { type: "string" } },
          required: ["name"],
        },
      },
      locations: { type: "array", items: { type: "string" } },
    },
    required: ["people", "locations"],
  },
  input,
});

console.log("[raw] People:", rawResult.output.people); // typed via generic
console.log("[raw] Locations:", rawResult.output.locations);

// ---------------------------------------------------------------------------
// 4. No output type — output_schema tells the API what to produce,
//    but TypeScript sees `unknown`. Cast as needed.
// ---------------------------------------------------------------------------

const untypedResult = await client.run("sdk-test-extract-entities", {
  input_schema,
  output_schema: { type: "object" },
  input,
});

console.log("[untyped] Output:", untypedResult.output); // unknown
