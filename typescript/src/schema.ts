// =============================================================================
// Standard Schema Integration — types, detection, and JSON Schema extraction
// =============================================================================

// ---------------------------------------------------------------------------
// Standard Schema V1 (type-only, zero runtime cost)
// Matches: https://github.com/standard-schema/standard-schema
// ---------------------------------------------------------------------------

/** Result type from Standard Schema validation. */
type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string }> };

/**
 * Standard Schema V1 interface.
 *
 * Implemented by Zod v4, Valibot, ArkType, and others.
 * Defined inline to avoid a runtime dependency on `@standard-schema/spec`.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

// ---------------------------------------------------------------------------
// Inference utility
// ---------------------------------------------------------------------------

/** Extract the output type from a Standard Schema. */
// biome-ignore lint/suspicious/noExplicitAny: `any` is required for conditional type inference
export type InferOutput<T> = T extends StandardSchemaV1<any, infer O> ? O : never;

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/** Check whether a value implements the Standard Schema V1 protocol. */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    "~standard" in value &&
    typeof (value as Record<string, unknown>)["~standard"] === "object" &&
    (value as Record<string, Record<string, unknown>>)["~standard"].version === 1
  );
}

// ---------------------------------------------------------------------------
// jsonSchema<T>() helper
// ---------------------------------------------------------------------------

/** Tag for schemas created by jsonSchema(). */
const JSON_SCHEMA_TAG = "__jsonSchema";

/** A Standard Schema wrapper around raw JSON Schema. */
export type JsonSchemaWrapper<T> = StandardSchemaV1<T, T> & {
  readonly [JSON_SCHEMA_TAG]: Record<string, unknown>;
};

/**
 * Wrap a raw JSON Schema object so it can be passed as `output_schema`
 * in `call()` — flows through the same overload as Zod / Valibot schemas.
 *
 * @example
 * ```typescript
 * const result = await client.call("fn", {
 *   output_schema: jsonSchema<{ name: string }>({ type: "object", properties: { name: { type: "string" } } }),
 *   input: "...",
 * });
 * result.data.name; // string
 * ```
 */
export function jsonSchema<T = unknown>(schema: Record<string, unknown>): JsonSchemaWrapper<T> {
  return {
    [JSON_SCHEMA_TAG]: schema,
    "~standard": {
      version: 1 as const,
      vendor: "json-schema",
      validate: (value) => ({ value: value as T }),
    },
  };
}

// ---------------------------------------------------------------------------
// toJsonSchema() — async JSON Schema extraction
// ---------------------------------------------------------------------------

/**
 * Resolve a value that may be a Standard Schema or a plain JSON Schema object.
 * Returns a plain JSON Schema in either case.
 */
export async function resolveSchema(
  value: Record<string, unknown> | StandardSchemaV1,
): Promise<Record<string, unknown>> {
  if (isStandardSchema(value)) {
    return toJsonSchema(value);
  }
  return value as Record<string, unknown>;
}

/**
 * Extract a JSON Schema object from a Standard Schema.
 *
 * Resolution order:
 * 1. `jsonSchema()` wrapper → return the embedded schema directly
 * 2. Zod v4 (vendor `"zod"`) → dynamic `import("zod")` then `z.toJSONSchema()`
 * 3. Other vendors → throw with a helpful message
 */
export async function toJsonSchema(schema: StandardSchemaV1): Promise<Record<string, unknown>> {
  // 1. jsonSchema() wrapper
  if (JSON_SCHEMA_TAG in schema) {
    return (schema as JsonSchemaWrapper<unknown>)[JSON_SCHEMA_TAG];
  }

  const vendor = schema["~standard"].vendor;

  // 2. Zod v4
  if (vendor === "zod") {
    try {
      const zod = await import("zod");
      // biome-ignore lint/suspicious/noExplicitAny: Zod's toJSONSchema expects its own schema type
      return zod.toJSONSchema(schema as any) as Record<string, unknown>;
    } catch {
      throw new Error(
        "Zod schema detected but could not import 'zod'. Install zod v4: npm install zod",
      );
    }
  }

  // 3. Other Standard Schema vendors
  throw new Error(
    `Standard Schema vendor "${vendor}" is not yet supported for automatic JSON Schema extraction. ` +
      "Pass output_schema directly, or wrap your JSON Schema with jsonSchema().",
  );
}
