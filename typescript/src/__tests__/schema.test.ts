import { describe, expect, it } from "vitest";
import { isStandardSchema, jsonSchema, type StandardSchemaV1, toJsonSchema } from "../schema.js";

describe("isStandardSchema", () => {
  it("returns true for a valid Standard Schema object", () => {
    const schema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v) => ({ value: v }),
      },
    };
    expect(isStandardSchema(schema)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isStandardSchema(null)).toBe(false);
  });

  it("returns false for a plain object", () => {
    expect(isStandardSchema({ type: "object" })).toBe(false);
  });

  it("returns false for wrong version", () => {
    expect(
      isStandardSchema({
        "~standard": { version: 2, vendor: "test", validate: () => ({}) },
      }),
    ).toBe(false);
  });
});

describe("jsonSchema", () => {
  it("wraps raw JSON Schema in a Standard Schema object", () => {
    const raw = { type: "object", properties: { name: { type: "string" } } };
    const wrapped = jsonSchema(raw);

    expect(isStandardSchema(wrapped)).toBe(true);
    expect(wrapped["~standard"].vendor).toBe("json-schema");
    expect(wrapped.__jsonSchema).toBe(raw);
  });

  it("validate returns the input value as-is", () => {
    const wrapped = jsonSchema({ type: "string" });
    const result = wrapped["~standard"].validate("hello");
    expect(result).toEqual({ value: "hello" });
  });
});

describe("toJsonSchema", () => {
  it("extracts JSON Schema from a jsonSchema() wrapper", async () => {
    const raw = { type: "object", properties: { x: { type: "number" } } };
    const wrapped = jsonSchema(raw);
    const result = await toJsonSchema(wrapped);
    expect(result).toBe(raw);
  });

  it("throws helpful error for unknown vendors", async () => {
    const schema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "unknown-lib",
        validate: (v) => ({ value: v }),
      },
    };
    await expect(toJsonSchema(schema)).rejects.toThrow(/unknown-lib.*not yet supported/);
  });
});
