// =============================================================================
// Opper SDK - Main Entry Point
// =============================================================================

import { ArtifactsClient } from "./clients/artifacts.js";
import { EmbeddingsClient } from "./clients/embeddings.js";
import { FunctionsClient } from "./clients/functions.js";
import { GenerationsClient } from "./clients/generations.js";
import { KnowledgeClient } from "./clients/knowledge.js";
import { ModelsClient } from "./clients/models.js";
import { SpansClient } from "./clients/spans.js";
import { SystemClient } from "./clients/system.js";
import { TracesClient } from "./clients/traces.js";
import { WebToolsClient } from "./clients/web-tools.js";
import { getTraceContext, runWithTraceContext } from "./context.js";
import type {
  GeneratedImage,
  GeneratedSpeech,
  GeneratedVideo,
  GenerateImageOptions,
  GenerateVideoOptions,
  MediaResponse,
  SpeechToTextOptions,
  TextToSpeechOptions,
  Transcription,
} from "./media.js";
import {
  buildGenerateImageRequest,
  buildGenerateVideoRequest,
  buildSpeechToTextRequest,
  buildTextToSpeechRequest,
  mediaResponse,
  resolveMediaArgs,
} from "./media.js";
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

  /** Client for trace operations. */
  readonly traces: TracesClient;

  /** Client for async artifact status polling. */
  readonly artifacts: ArtifactsClient;

  /** Beta API endpoints — these may change. */
  readonly beta: { readonly web: WebToolsClient };

  /** Client for knowledge base operations (v2 API). */
  readonly knowledge: KnowledgeClient;

  constructor(config?: ClientConfig) {
    const resolved = resolveConfig(config);

    this.functions = new FunctionsClient(resolved);
    this.spans = new SpansClient(resolved);
    this.generations = new GenerationsClient(resolved);
    this.models = new ModelsClient(resolved);
    this.embeddings = new EmbeddingsClient(resolved);
    this.system = new SystemClient(resolved);
    this.traces = new TracesClient(resolved);
    this.artifacts = new ArtifactsClient(resolved);
    this.beta = { web: new WebToolsClient(resolved) };
    this.knowledge = new KnowledgeClient(resolved);
  }

  /**
   * Call a function by name and return the result.
   *
   * `output_schema` accepts either a Standard Schema (Zod, Valibot, etc.) or raw JSON Schema.
   * When a Standard Schema is provided, the response type is inferred automatically.
   *
   * @example
   * ```typescript
   * // With Zod schema (inferred output type)
   * import { z } from "zod";
   * const result = await opper.call("summarize", {
   *   output_schema: z.object({ summary: z.string() }),
   *   input: { text: "Long article..." },
   * });
   * result.data.summary; // string — inferred!
   *
   * // With raw JSON Schema (manual generic)
   * const result = await opper.call<{ summary: string }>("summarize", {
   *   output_schema: { type: "object", properties: { summary: { type: "string" } } },
   *   input: { text: "Long article..." },
   * });
   * ```
   */
  async call<S extends StandardSchemaV1>(
    name: string,
    request: Omit<SchemaRunRequest, "output_schema"> & { output_schema: S },
    options?: RequestOptions,
  ): Promise<RunResponse<InferOutput<S>>>;
  async call<T = unknown>(
    name: string,
    request: RunRequest,
    options?: RequestOptions,
  ): Promise<RunResponse<T>>;
  async call(
    name: string,
    request: RunRequest | SchemaRunRequest,
    options?: RequestOptions,
  ): Promise<RunResponse> {
    return this.functions.runFunction(name, await this.resolveRequest(request), options);
  }

  /**
   * Stream a function execution by name, yielding chunks as they arrive.
   *
   * `output_schema` accepts either a Standard Schema (Zod, Valibot, etc.) or raw JSON Schema.
   *
   * @example
   * ```typescript
   * for await (const chunk of opper.stream("summarize", { ... })) {
   *   if (chunk.type === "content") process.stdout.write(chunk.delta);
   *   if (chunk.type === "done") console.log(chunk.usage);
   * }
   * ```
   */
  stream<S extends StandardSchemaV1>(
    name: string,
    request: Omit<SchemaRunRequest, "output_schema"> & { output_schema: S },
    options?: RequestOptions,
  ): AsyncGenerator<StreamChunk<InferOutput<S>>, void, undefined>;
  stream<T = unknown>(
    name: string,
    request: RunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<StreamChunk<T>, void, undefined>;
  async *stream(
    name: string,
    request: RunRequest | SchemaRunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<StreamChunk, void, undefined> {
    yield* this.functions.streamFunction(name, await this.resolveRequest(request), options);
  }

  /**
   * Wrap a block of code in a trace span. All `call()` and `stream()` calls
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
   * const result = await opper.traced("my-flow", async () => {
   *   const r1 = await opper.call("step1", { input: "hello" });
   *   const r2 = await opper.call("step2", { input: r1.data });
   *   return r2;
   * });
   *
   * // Explicit span handle for metadata
   * await opper.traced("my-flow", async (span) => {
   *   console.log("trace:", span.traceId, "span:", span.id);
   *   await opper.call("step1", { input: "hello" });
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
      // biome-ignore lint/style/noNonNullAssertion: guaranteed by overload signatures
      fn = maybeFn!;
    } else {
      opts = fnOrNameOrOptions;
      // biome-ignore lint/style/noNonNullAssertion: guaranteed by overload signatures
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
      result = await runWithTraceContext({ spanId: span.id, traceId: span.trace_id }, () =>
        fn(handle),
      );
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

  // -------------------------------------------------------------------------
  // Media Convenience Methods
  // -------------------------------------------------------------------------

  /**
   * Generate an image from a text prompt.
   *
   * @example
   * ```typescript
   * // Generate from scratch
   * const result = await opper.generateImage({ prompt: "A sunset over a calm ocean" });
   * writeFileSync("sunset.png", Buffer.from(result.data.image, "base64"));
   *
   * // With a reference image
   * const result = await opper.generateImage("edit-photo", {
   *   prompt: "Add sunglasses and a party hat",
   *   reference_image: { path: "./cat.png" },
   * });
   *
   * // With explicit function name and options
   * const result = await opper.generateImage("hero-image", {
   *   prompt: "Product photo on white background",
   *   model: "openai/dall-e-3",
   *   size: "1792x1024",
   *   quality: "hd",
   * });
   * ```
   */
  async generateImage(
    options: GenerateImageOptions,
    requestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedImage>>;
  async generateImage(
    name: string,
    options: GenerateImageOptions,
    requestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedImage>>;
  async generateImage(
    nameOrOptions: string | GenerateImageOptions,
    optionsOrRequestOptions?: GenerateImageOptions | RequestOptions,
    maybeRequestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedImage>> {
    const [name, opts, reqOpts] = resolveMediaArgs<GenerateImageOptions>(
      "image-gen",
      nameOrOptions,
      optionsOrRequestOptions,
      maybeRequestOptions,
    );
    const result = await this.call<GeneratedImage>(name, buildGenerateImageRequest(opts), reqOpts);
    return mediaResponse(result, "image", "mime_type");
  }

  /**
   * Generate a video from a text prompt.
   *
   * @example
   * ```typescript
   * const result = await opper.generateVideo({
   *   prompt: "A cat walking down a city street, cinematic",
   *   model: "openai/sora-2",
   *   aspect_ratio: "16:9",
   * });
   * result.save("./cat"); // → "./cat.mp4"
   * ```
   */
  async generateVideo(
    options: GenerateVideoOptions,
    requestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedVideo>>;
  async generateVideo(
    name: string,
    options: GenerateVideoOptions,
    requestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedVideo>>;
  async generateVideo(
    nameOrOptions: string | GenerateVideoOptions,
    optionsOrRequestOptions?: GenerateVideoOptions | RequestOptions,
    maybeRequestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedVideo>> {
    const [name, opts, reqOpts] = resolveMediaArgs<GenerateVideoOptions>(
      "video-gen",
      nameOrOptions,
      optionsOrRequestOptions,
      maybeRequestOptions,
    );
    const result = await this.call<GeneratedVideo>(name, buildGenerateVideoRequest(opts), reqOpts);
    return mediaResponse(result, "video", "mime_type");
  }

  /**
   * Convert text to speech audio.
   *
   * @example
   * ```typescript
   * const result = await opper.textToSpeech({
   *   text: "Hello! Welcome to our platform.",
   *   voice: "alloy",
   * });
   * result.save("./welcome.mp3");
   * ```
   */
  async textToSpeech(
    options: TextToSpeechOptions,
    requestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedSpeech>>;
  async textToSpeech(
    name: string,
    options: TextToSpeechOptions,
    requestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedSpeech>>;
  async textToSpeech(
    nameOrOptions: string | TextToSpeechOptions,
    optionsOrRequestOptions?: TextToSpeechOptions | RequestOptions,
    maybeRequestOptions?: RequestOptions,
  ): Promise<MediaResponse<GeneratedSpeech>> {
    const [name, opts, reqOpts] = resolveMediaArgs<TextToSpeechOptions>(
      "tts",
      nameOrOptions,
      optionsOrRequestOptions,
      maybeRequestOptions,
    );
    const result = await this.call<GeneratedSpeech>(name, buildTextToSpeechRequest(opts), reqOpts);
    return mediaResponse(result, "audio");
  }

  /**
   * Transcribe audio to text.
   *
   * @example
   * ```typescript
   * const result = await opper.transcribe({
   *   audio: { path: "./meeting.mp3" },
   *   language: "en",
   * });
   * console.log(result.data.text, result.data.language);
   * ```
   */
  async transcribe(
    options: SpeechToTextOptions,
    requestOptions?: RequestOptions,
  ): Promise<RunResponse<Transcription>>;
  async transcribe(
    name: string,
    options: SpeechToTextOptions,
    requestOptions?: RequestOptions,
  ): Promise<RunResponse<Transcription>>;
  async transcribe(
    nameOrOptions: string | SpeechToTextOptions,
    optionsOrRequestOptions?: SpeechToTextOptions | RequestOptions,
    maybeRequestOptions?: RequestOptions,
  ): Promise<RunResponse<Transcription>> {
    const [name, opts, reqOpts] = resolveMediaArgs<SpeechToTextOptions>(
      "stt",
      nameOrOptions,
      optionsOrRequestOptions,
      maybeRequestOptions,
    );
    return this.call<Transcription>(name, buildSpeechToTextRequest(opts), reqOpts);
  }

  /** Resolve any Standard Schema fields (output_schema, input_schema, tools) to plain JSON Schema. */
  private async resolveRequest(request: RunRequest | SchemaRunRequest): Promise<RunRequest> {
    const wire: Record<string, unknown> = {};

    // output_schema — resolve Standard Schema to JSON Schema, or pass through raw JSON Schema
    if (request.output_schema != null) {
      if (isStandardSchema(request.output_schema)) {
        wire.output_schema = await toJsonSchema(request.output_schema);
      } else {
        wire.output_schema = request.output_schema;
      }
    }

    // input_schema
    if (request.input_schema != null) {
      wire.input_schema = await resolveSchema(request.input_schema);
    }

    // tools — resolve each tool's parameters
    const tools = request.tools;
    if (tools != null) {
      wire.tools = await Promise.all(
        tools.map(async (tool) => {
          const resolved: Record<string, unknown> = { name: tool.name };
          if (tool.description) resolved.description = tool.description;
          if (tool.parameters != null) resolved.parameters = await resolveSchema(tool.parameters);
          if (tool.type) resolved.type = tool.type;
          return resolved;
        }),
      );
    }

    // Pass through remaining fields
    wire.input = request.input;
    if (request.model) wire.model = request.model;
    if (request.temperature != null) wire.temperature = request.temperature;
    if (request.max_tokens != null) wire.max_tokens = request.max_tokens;
    if (request.reasoning_effort) wire.reasoning_effort = request.reasoning_effort;
    if (request.instructions) wire.instructions = request.instructions;
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
export { KnowledgeClient } from "./clients/knowledge.js";
export type { ListModelsParams } from "./clients/models.js";
export { ModelsClient } from "./clients/models.js";
export { SpansClient } from "./clients/spans.js";
export { SystemClient } from "./clients/system.js";
export { TracesClient } from "./clients/traces.js";
export { WebToolsClient } from "./clients/web-tools.js";

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
  AddDocumentRequest,
  AddDocumentResponse,
  ArtifactStatus,
  ClientConfig,
  CompleteChunk,
  ContentChunk,
  CreateKnowledgeBaseRequest,
  CreateKnowledgeBaseResponse,
  CreateSpanRequest,
  CreateSpanResponse,
  DeleteDocumentsRequest,
  DeleteDocumentsResponse,
  DocumentSegment,
  DoneChunk,
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsUsageInfo,
  ErrorChunk,
  ErrorDetail,
  ErrorResponse,
  FilterOp,
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  GetDocumentResponse,
  GetKnowledgeBaseResponse,
  GetSpanResponse,
  GetTraceResponse,
  GetUploadUrlResponse,
  JsonSchema,
  JsonValue,
  KnowledgeBaseFilter,
  KnowledgeBaseInfo,
  ListFilesResponse,
  ListGenerationsParams,
  ListTracesItem,
  ListTracesParams,
  ListTracesResponse,
  ModelInfo,
  ModelsResponse,
  PaginatedResponse,
  PendingOperation,
  QueryKnowledgeBaseRequest,
  QueryKnowledgeBaseResponse,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  RegisterFileUploadRequest,
  RegisterFileUploadResponse,
  RequestOptions,
  ResponseMeta,
  RevisionInfo,
  RunRequest,
  RunResponse,
  SchemaLike,
  SchemaRunRequest,
  SpanHandle,
  StreamChunk,
  TextProcessingConfiguration,
  Tool,
  ToolCallDeltaChunk,
  ToolCallStartChunk,
  TracedOptions,
  TraceSpan,
  UpdateFunctionRequest,
  UpdateSpanRequest,
  UploadFileResponse,
  UsageInfo,
  WebFetchRequest,
  WebFetchResponse,
  WebSearchRequest,
  WebSearchResponse,
  WebSearchResult,
} from "./types.js";

export {
  ApiError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
} from "./types.js";

// ---------------------------------------------------------------------------
// Re-exports: Media types
// ---------------------------------------------------------------------------

export type {
  GeneratedImage,
  GeneratedSpeech,
  GeneratedVideo,
  GenerateImageOptions,
  GenerateVideoOptions,
  MediaBaseOptions,
  MediaInput,
  MediaResponse,
  SpeechToTextOptions,
  TextToSpeechOptions,
  Transcription,
} from "./media.js";
export { saveMedia } from "./media.js";
