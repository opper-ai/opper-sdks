// =============================================================================
// Opper SDK - Main Entry Point
// =============================================================================

import { EmbeddingsClient } from "./clients/embeddings.js";
import { FunctionsClient } from "./clients/functions.js";
import { GenerationsClient } from "./clients/generations.js";
import { ModelsClient } from "./clients/models.js";
import { SpansClient } from "./clients/spans.js";
import { SystemClient } from "./clients/system.js";
import { getTraceContext, runWithTraceContext } from "./context.js";
import type { InferOutput, StandardSchemaV1 } from "./schema.js";
import { isStandardSchema, resolveSchema, toJsonSchema } from "./schema.js";
import type {
  ClientConfig,
  RequestOptions,
  RunRequest,
  RunResponse,
  SchemaRunRequest,
  SpanHandle,
  StreamChunk,
  TracedOptions,
} from "./types.js";

// ---------------------------------------------------------------------------
// Resolve config from env vars
// ---------------------------------------------------------------------------

function resolveConfig(config?: ClientConfig): Required<
  Pick<ClientConfig, "apiKey" | "baseUrl">
> & {
  headers?: Record<string, string>;
} {
  const apiKey =
    config?.apiKey || (typeof process !== "undefined" ? process.env.OPPER_API_KEY : undefined);
  if (!apiKey) {
    throw new Error(
      "Missing API key. Pass apiKey in the config or set the OPPER_API_KEY environment variable.",
    );
  }

  const baseUrl =
    config?.baseUrl ||
    (typeof process !== "undefined" ? process.env.OPPER_BASE_URL : undefined) ||
    "https://api.opper.ai";

  return { apiKey, baseUrl, headers: config?.headers };
}

// ---------------------------------------------------------------------------
// Opper Client
// ---------------------------------------------------------------------------

/**
 * Unified client for the Opper API.
 *
 * @param config - Optional configuration object:
 *   - `apiKey` — API key (falls back to `OPPER_API_KEY` env var)
 *   - `baseUrl` — API host URL (falls back to `OPPER_BASE_URL` env var, default: `https://api.opper.ai`). Do not include `/v3` — it is added automatically.
 *   - `headers` — Additional headers to include in every request
 *
 * @example
 * ```typescript
 * // Uses OPPER_API_KEY env var
 * const client = new Opper();
 *
 * // Explicit config
 * const client = new Opper({ apiKey: 'op-...', baseUrl: 'https://api.opper.ai' });
 * ```
 */
export class Opper {
  /** Client for function management and execution. */
  readonly functions: FunctionsClient;

  /** Client for trace spans. */
  readonly spans: SpansClient;

  /** Client for recorded generations. */
  readonly generations: GenerationsClient;

  /** Client for listing available models. */
  readonly models: ModelsClient;

  /** Client for OpenAI-compatible embeddings. */
  readonly embeddings: EmbeddingsClient;

  /** Client for system health checks. */
  readonly system: SystemClient;

  constructor(config?: ClientConfig) {
    const resolved = resolveConfig(config);

    this.functions = new FunctionsClient(resolved);
    this.spans = new SpansClient(resolved);
    this.generations = new GenerationsClient(resolved);
    this.models = new ModelsClient(resolved);
    this.embeddings = new EmbeddingsClient(resolved);
    this.system = new SystemClient(resolved);
  }

  /**
   * Execute a function by name and return the result.
   *
   * Accepts either a Standard Schema (`output`) or a raw JSON Schema (`output_schema`).
   * When a Standard Schema is provided, the response type is inferred automatically.
   *
   * @example
   * ```typescript
   * // With Zod schema (inferred output type)
   * import { z } from "zod";
   * const result = await client.run("summarize", {
   *   output: z.object({ summary: z.string() }),
   *   input: { text: "Long article..." },
   * });
   * result.output.summary; // string — inferred!
   *
   * // With raw JSON Schema (manual generic)
   * const result = await client.run<{ summary: string }>("summarize", {
   *   output_schema: { type: "object", properties: { summary: { type: "string" } } },
   *   input: { text: "Long article..." },
   * });
   * ```
   */
  async run<S extends StandardSchemaV1>(
    name: string,
    request: Omit<SchemaRunRequest, "output"> & { output: S },
    options?: RequestOptions,
  ): Promise<RunResponse<InferOutput<S>>>;
  async run<T = unknown>(
    name: string,
    request: RunRequest,
    options?: RequestOptions,
  ): Promise<RunResponse<T>>;
  async run(
    name: string,
    request: RunRequest | SchemaRunRequest,
    options?: RequestOptions,
  ): Promise<RunResponse> {
    return this.functions.runFunction(name, await this.resolveRequest(request), options);
  }

  /**
   * Stream a function execution by name, yielding chunks as they arrive.
   *
   * Accepts either a Standard Schema (`output`) or a raw JSON Schema (`output_schema`).
   *
   * @example
   * ```typescript
   * for await (const chunk of client.stream("summarize", { ... })) {
   *   if (chunk.type === "content") process.stdout.write(chunk.delta);
   *   if (chunk.type === "done") console.log(chunk.usage);
   * }
   * ```
   */
  async *stream(
    name: string,
    request: RunRequest | SchemaRunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<StreamChunk, void, undefined> {
    yield* this.functions.streamFunction(name, await this.resolveRequest(request), options);
  }

  /**
   * Wrap a block of code in a trace span. All `run()` and `stream()` calls
   * inside the callback automatically inherit the span as their parent.
   *
   * Supports three call signatures:
   * - `traced(fn)` — uses default name `"traced"`
   * - `traced("my-span", fn)` — uses the given name
   * - `traced({ name, input, meta, tags }, fn)` — full options
   *
   * The callback receives a {@link SpanHandle} for accessing the span/trace IDs
   * or passing them explicitly. Nesting is supported — inner `traced()` calls
   * create child spans of the outer one.
   *
   * @example
   * ```typescript
   * // Automatic context — no manual wiring
   * const result = await client.traced("my-flow", async () => {
   *   const r1 = await client.run("step1", { input: "hello" });
   *   const r2 = await client.run("step2", { input: r1.output });
   *   return r2;
   * });
   *
   * // Explicit span handle for metadata
   * await client.traced("my-flow", async (span) => {
   *   console.log("trace:", span.traceId, "span:", span.id);
   *   await client.run("step1", { input: "hello" });
   * });
   * ```
   */
  async traced<T>(fn: (span: SpanHandle) => Promise<T>): Promise<T>;
  async traced<T>(name: string, fn: (span: SpanHandle) => Promise<T>): Promise<T>;
  async traced<T>(options: TracedOptions, fn: (span: SpanHandle) => Promise<T>): Promise<T>;
  async traced<T>(
    fnOrNameOrOptions: ((span: SpanHandle) => Promise<T>) | string | TracedOptions,
    maybeFn?: (span: SpanHandle) => Promise<T>,
  ): Promise<T> {
    // Parse overloads
    let opts: TracedOptions;
    let fn: (span: SpanHandle) => Promise<T>;
    if (typeof fnOrNameOrOptions === "function") {
      opts = {};
      fn = fnOrNameOrOptions;
    } else if (typeof fnOrNameOrOptions === "string") {
      opts = { name: fnOrNameOrOptions };
      fn = maybeFn!;
    } else {
      opts = fnOrNameOrOptions;
      fn = maybeFn!;
    }

    // If nested inside another traced() block, inherit trace_id and set parent
    const parentCtx = getTraceContext();

    const span = await this.spans.create({
      name: opts.name ?? "traced",
      start_time: new Date().toISOString(),
      input: opts.input,
      meta: opts.meta,
      tags: opts.tags,
      ...(parentCtx ? { trace_id: parentCtx.traceId, parent_id: parentCtx.spanId } : {}),
    });

    const handle: SpanHandle = { id: span.id, traceId: span.trace_id };

    let result: T;
    try {
      result = await runWithTraceContext({ spanId: span.id, traceId: span.trace_id }, () => fn(handle));
    } catch (error) {
      await this.spans.update(span.id, {
        error: error instanceof Error ? error.message : String(error),
        end_time: new Date().toISOString(),
      });
      throw error;
    }

    await this.spans.update(span.id, {
      end_time: new Date().toISOString(),
    });

    return result;
  }

  /** Resolve any Standard Schema fields (output, input_schema, tools) to plain JSON Schema. */
  private async resolveRequest(request: RunRequest | SchemaRunRequest): Promise<RunRequest> {
    const wire: Record<string, unknown> = {};

    // output → output_schema
    if ("output" in request && request.output != null && isStandardSchema(request.output)) {
      wire.output_schema = await toJsonSchema(request.output);
    } else if ("output_schema" in request) {
      wire.output_schema = (request as RunRequest).output_schema;
    }

    // input_schema
    if (request.input_schema != null) {
      wire.input_schema = await resolveSchema(request.input_schema);
    }

    // tools — resolve each tool's parameters
    const tools = request.tools;
    if (tools != null) {
      wire.tools = await Promise.all(
        tools.map(async (tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: await resolveSchema(tool.parameters),
        })),
      );
    }

    // Pass through remaining fields
    wire.input = request.input;
    if (request.model) wire.model = request.model;
    if (request.temperature != null) wire.temperature = request.temperature;
    if (request.max_tokens != null) wire.max_tokens = request.max_tokens;
    if (request.reasoning_effort) wire.reasoning_effort = request.reasoning_effort;
    // Explicit parent_span_id takes priority, then ALS context
    if (request.parent_span_id) {
      wire.parent_span_id = request.parent_span_id;
    } else {
      const ctx = getTraceContext();
      if (ctx) wire.parent_span_id = ctx.spanId;
    }

    return wire as unknown as RunRequest;
  }
}

// ---------------------------------------------------------------------------
// Re-exports: Sub-clients
// ---------------------------------------------------------------------------

export { BaseClient } from "./client-base.js";
export { EmbeddingsClient } from "./clients/embeddings.js";
export { FunctionsClient } from "./clients/functions.js";
export { GenerationsClient } from "./clients/generations.js";
export { ModelsClient } from "./clients/models.js";
export { SpansClient } from "./clients/spans.js";
export { SystemClient } from "./clients/system.js";

// ---------------------------------------------------------------------------
// Re-exports: Sub-client specific types
// ---------------------------------------------------------------------------

export type {
  CreateRealtimeFunctionRequest,
  Example,
  ListExamplesParams,
  ListExamplesResponse,
  ListFunctionsResponse,
  ListRevisionsResponse,
} from "./clients/functions.js";

export type {
  DeleteGenerationResponse,
  Generation,
  GenerationsListMeta,
  GenerationsListResponse,
  ListGenerationsParams as GenerationsListParams,
} from "./clients/generations.js";

export type { HealthCheckResponse } from "./clients/system.js";

// ---------------------------------------------------------------------------
// Re-exports: Schema utilities
// ---------------------------------------------------------------------------

export type { InferOutput, StandardSchemaV1 } from "./schema.js";
export { isStandardSchema, jsonSchema } from "./schema.js";

// ---------------------------------------------------------------------------
// Re-exports: Trace context
// ---------------------------------------------------------------------------

export type { TraceContext } from "./context.js";
export { getTraceContext } from "./context.js";

// ---------------------------------------------------------------------------
// Re-exports: All types
// ---------------------------------------------------------------------------

export type {
  ClientConfig,
  ContentChunk,
  CreateSpanRequest,
  CreateSpanResponse,
  DoneChunk,
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsUsageInfo,
  ErrorChunk,
  ErrorDetail,
  ErrorResponse,
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  JsonSchema,
  JsonValue,
  ListGenerationsParams,
  ModelInfo,
  ModelsResponse,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  RequestOptions,
  ResponseMeta,
  RevisionInfo,
  RunRequest,
  RunResponse,
  SchemaLike,
  SchemaRunRequest,
  SchemaTool,
  SpanHandle,
  StreamChunk,
  Tool,
  ToolCallDeltaChunk,
  ToolCallStartChunk,
  TracedOptions,
  UpdateFunctionRequest,
  UpdateSpanRequest,
  UsageInfo,
} from "./types.js";

export { ApiError } from "./types.js";
