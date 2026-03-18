// Using schemas — advanced: all approaches compared
// Shows Zod for all three schema positions, jsonSchema() helper, raw JSON Schema, and no-schema.
import { z } from "zod";
import { jsonSchema, Opper } from "../../src/index.js";

const opper = new Opper();

const input = {
  text: "Marie Curie conducted groundbreaking research on radioactivity in Paris. She was the first woman to win a Nobel Prize.",
};

// ---------------------------------------------------------------------------
// 1. Zod everywhere — input_schema, output, and tools all use Zod
// ---------------------------------------------------------------------------

const zodResult = await opper.call("sdk-test-extract-entities", {
  input_schema: z.object({ text: z.string() }),
  output: z.object({
    people: z.array(z.object({ name: z.string(), role: z.string().optional() })),
    locations: z.array(z.string()),
  }),
  input,
});

console.log("[Zod] People:", zodResult.output.people); // typed!
console.log("[Zod] Locations:", zodResult.output.locations); // typed!

// ---------------------------------------------------------------------------
// 2. jsonSchema() helper — raw JSON Schema wrapped in Standard Schema
//    Same `output` overload, type via generic annotation.
// ---------------------------------------------------------------------------

interface ExtractedEntities {
  people: { name: string; role?: string }[];
  locations: string[];
}

const outputSchema = {
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
};

const jsonSchemaResult = await opper.call("sdk-test-extract-entities", {
  input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  output: jsonSchema<ExtractedEntities>(outputSchema),
  input,
});

console.log("[jsonSchema] People:", jsonSchemaResult.output.people); // typed!
console.log("[jsonSchema] Locations:", jsonSchemaResult.output.locations); // typed!

// ---------------------------------------------------------------------------
// 3. Raw output_schema + generic — escape hatch, no extra deps
// ---------------------------------------------------------------------------

const rawResult = await opper.call<ExtractedEntities>("sdk-test-extract-entities", {
  input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  output_schema: outputSchema,
  input,
});

console.log("[raw] People:", rawResult.output.people); // typed via generic
console.log("[raw] Locations:", rawResult.output.locations);

// ---------------------------------------------------------------------------
// 4. No output type — output is `unknown`, cast as needed
// ---------------------------------------------------------------------------

const untypedResult = await opper.call("sdk-test-extract-entities", {
  input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  output_schema: { type: "object" },
  input,
});

console.log("[untyped] Output:", untypedResult.output); // unknown
