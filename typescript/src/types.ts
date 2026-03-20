// =============================================================================
// Opper SDK - Type Definitions
// =============================================================================

// ---------------------------------------------------------------------------
// JSON Utility Types
// ---------------------------------------------------------------------------

/** A JSON Schema object. */
export type JsonSchema = Record<string, unknown>;

/** Any valid JSON value. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

/** Configuration for the Opper SDK client. */
export interface ClientConfig {
  /** API key for authentication. Falls back to OPPER_API_KEY env var. */
  readonly apiKey?: string;
  /** Base URL for the API. Falls back to OPPER_BASE_URL env var, then https://api.opper.ai */
  readonly baseUrl?: string;
  /** Additional headers to include in requests. */
  readonly headers?: Record<string, string>;
}

/** Options for HTTP requests. */
export interface RequestOptions {
  /** Additional headers for this request. */
  readonly headers?: Record<string, string>;
  /** AbortSignal for request cancellation. */
  readonly signal?: AbortSignal;
  /** Timeout in milliseconds, overrides client default. */
  readonly timeout?: number;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/** API error with status code and response body. */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/** Error detail returned by the API. */
export interface ErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/** Error response wrapper from the API. */
export interface ErrorResponse {
  readonly error: ErrorDetail;
}

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

/** Tool definition for function execution. */
export interface Tool {
  readonly name: string;
  readonly description?: string;
  readonly parameters: JsonSchema;
}

/** Token usage information. */
export interface UsageInfo {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly reasoning_tokens?: number;
  readonly cache_read_tokens?: number;
  readonly cache_creation_tokens?: number;
  readonly cache_creation_1h_tokens?: number;
  readonly input_audio_tokens?: number;
  readonly output_audio_tokens?: number;
}

/** Response metadata from function execution. */
export interface ResponseMeta {
  readonly function_name: string;
  readonly script_cached: boolean;
  readonly execution_ms: number;
  readonly llm_calls: number;
  readonly tts_calls: number;
  readonly image_gen_calls: number;
  readonly generation_ms?: number;
  readonly cost?: number;
  readonly usage?: UsageInfo;
  readonly models_used?: string[];
  readonly model_warnings?: string[];
  readonly guards?: unknown[];
}

/** Request to run a function. */
export interface RunRequest {
  /** JSON Schema describing the input shape. Defaults to text when omitted. */
  readonly input_schema?: JsonSchema;
  /** JSON Schema describing the expected output shape. Defaults to text when omitted. */
  readonly output_schema?: JsonSchema;
  /** The input data to send to the function. */
  readonly input: JsonValue;
  /** Model to use, e.g. `"anthropic/claude-sonnet-4-6"` or `"gcp/gemini-3-flash-preview"`. */
  readonly model?: string;
  /** Sampling temperature (0–2). Lower = more deterministic. */
  readonly temperature?: number;
  /** Maximum tokens in the response. */
  readonly max_tokens?: number;
  /** Reasoning effort hint, e.g. `"low"`, `"medium"`, `"high"`. */
  readonly reasoning_effort?: string;
  /** Instructions for the function. */
  readonly instructions?: string;
  /** Parent span ID for tracing/observability. */
  readonly parent_span_id?: string;
  /** Tool definitions available to the function. */
  readonly tools?: Tool[];
}

/** A JSON Schema or a Standard Schema (Zod, Valibot, ArkType, etc.). */
export type SchemaLike = JsonSchema | import("./schema.js").StandardSchemaV1;

/** Tool definition that accepts Standard Schema for parameters. */
export interface SchemaTool {
  readonly name: string;
  readonly description?: string;
  readonly parameters: SchemaLike;
}

/** Request to run a function with a Standard Schema for output type inference. */
export interface SchemaRunRequest<TOutput = unknown> {
  /** Standard Schema (Zod, Valibot, ArkType, etc.) defining the expected output shape. */
  // biome-ignore lint/suspicious/noExplicitAny: `any` allows accepting schemas with any input type
  readonly output: import("./schema.js").StandardSchemaV1<any, TOutput>;
  /** The input data to send to the function. */
  readonly input: JsonValue;
  /** JSON Schema or Standard Schema describing the input shape. Defaults to text when omitted. */
  readonly input_schema?: SchemaLike;
  /** Model to use, e.g. `"anthropic/claude-sonnet-4-6"` or `"gcp/gemini-3-flash-preview"`. */
  readonly model?: string;
  /** Sampling temperature (0–2). Lower = more deterministic. */
  readonly temperature?: number;
  /** Maximum tokens in the response. */
  readonly max_tokens?: number;
  /** Reasoning effort hint, e.g. `"low"`, `"medium"`, `"high"`. */
  readonly reasoning_effort?: string;
  /** Instructions for the function. */
  readonly instructions?: string;
  /** Parent span ID for tracing/observability. */
  readonly parent_span_id?: string;
  /** Tool definitions that accept Standard Schema for parameters. */
  readonly tools?: SchemaTool[];
}

/** Response from running a function. */
export interface RunResponse<T = unknown> {
  readonly output: T;
  readonly meta?: ResponseMeta;
}

/** SSE stream chunk: content text delta. */
export interface ContentChunk {
  readonly type: "content";
  readonly delta: string;
  readonly tool_call_index?: number;
}

/** SSE stream chunk: start of a tool call. */
export interface ToolCallStartChunk {
  readonly type: "tool_call_start";
  readonly tool_call_index: number;
  readonly tool_call_id: string;
  readonly tool_call_name: string;
}

/** SSE stream chunk: incremental tool call arguments. */
export interface ToolCallDeltaChunk {
  readonly type: "tool_call_delta";
  readonly tool_call_index: number;
  readonly tool_call_args: string;
  readonly tool_call_thought_sig?: string;
}

/** SSE stream chunk: stream completed. */
export interface DoneChunk {
  readonly type: "done";
  readonly usage?: UsageInfo;
  readonly tool_call_index?: number;
}

/** SSE stream chunk: error occurred. */
export interface ErrorChunk {
  readonly type: "error";
  readonly error: string;
}

/** SSE stream chunk: final parsed result from `event: complete`. */
export interface CompleteChunk {
  readonly type: "complete";
  readonly output: unknown;
  readonly meta?: ResponseMeta;
}

/** SSE stream chunk from /stream endpoint. */
export type StreamChunk =
  | ContentChunk
  | ToolCallStartChunk
  | ToolCallDeltaChunk
  | DoneChunk
  | ErrorChunk
  | CompleteChunk;

/** Request to update a function. */
export interface UpdateFunctionRequest {
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Function Types
// ---------------------------------------------------------------------------

/** Detailed function information including schemas. */
export interface FunctionDetails {
  readonly name: string;
  readonly schema_hash: string;
  readonly generated_at: string;
  readonly hit_count: number;
  readonly source: string;
  readonly input_schema: JsonSchema;
  readonly output_schema: JsonSchema;
}

/** Summary function information. */
export interface FunctionInfo {
  readonly name: string;
  readonly schema_hash: string;
  readonly generated_at: string;
  readonly hit_count: number;
  readonly has_script: boolean;
}

/** Function revision with schema details. */
export interface FunctionRevision {
  readonly revision_id: number;
  readonly source: string;
  readonly schema_hash: string;
  readonly created_at: string;
  readonly input_schema: JsonSchema;
  readonly output_schema: JsonSchema;
}

/** Revision info summary. */
export interface RevisionInfo {
  readonly revision_id: number;
  readonly created_at: string;
  readonly schema_hash: string;
  readonly is_current: boolean;
}

/** Request to create a realtime function. */
export interface RealtimeCreateRequest {
  readonly name: string;
  readonly script: string;
  readonly cached: boolean;
  readonly reasoning?: string;
}

/** Response from creating a realtime function. */
export interface RealtimeCreateResponse {
  readonly name: string;
  readonly script: string;
  readonly cached: boolean;
  readonly reasoning?: string;
}

// ---------------------------------------------------------------------------
// Span Types
// ---------------------------------------------------------------------------

/** Request to create a span. */
export interface CreateSpanRequest {
  readonly name: string;
  readonly trace_id?: string;
  readonly parent_id?: string;
  readonly type?: string;
  readonly input?: string;
  readonly output?: string;
  readonly error?: string;
  readonly start_time?: string;
  readonly end_time?: string;
  readonly meta?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: Record<string, unknown>;
}

/** Response from creating a span. */
export interface CreateSpanResponse {
  readonly id: string;
  readonly trace_id: string;
  readonly name: string;
  readonly parent_id?: string;
  readonly type?: string;
}

/** Request to update a span. */
export interface UpdateSpanRequest {
  readonly output?: string;
  readonly error?: string;
  readonly end_time?: string;
  readonly meta?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tracing Types
// ---------------------------------------------------------------------------

/** Options for the `traced()` method. */
export interface TracedOptions {
  /** Name for the trace span. Defaults to `"traced"`. */
  readonly name?: string;
  /** Input to record on the span. */
  readonly input?: string;
  /** Custom metadata for the span. */
  readonly meta?: Record<string, unknown>;
  /** Tags for filtering. */
  readonly tags?: Record<string, unknown>;
}

/** Handle to the current span inside a `traced()` callback. */
export interface SpanHandle {
  /** The span ID. */
  readonly id: string;
  /** The trace ID. */
  readonly traceId: string;
}

// ---------------------------------------------------------------------------
// Embeddings Types
// ---------------------------------------------------------------------------

/** A single embedding data item. */
export interface EmbeddingsDataItem {
  readonly object: string;
  readonly index: number;
  readonly embedding: number[];
}

/** Token usage for embeddings requests. */
export interface EmbeddingsUsageInfo {
  readonly prompt_tokens: number;
  readonly total_tokens: number;
}

/** Embeddings request. */
export interface EmbeddingsRequest {
  readonly input: string | string[];
  readonly model: string;
  readonly dimensions?: number;
  readonly encoding_format?: string;
  readonly user?: string;
}

/** Embeddings response. */
export interface EmbeddingsResponse {
  readonly object: string;
  readonly data: EmbeddingsDataItem[];
  readonly model: string;
  readonly usage: EmbeddingsUsageInfo;
}

// ---------------------------------------------------------------------------
// Models Types
// ---------------------------------------------------------------------------

/** Information about an available model. */
export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly capabilities?: Record<string, unknown>;
  readonly pricing?: Record<string, unknown>;
  readonly parameters?: Record<string, unknown>;
}

/** Response containing list of models. */
export interface ModelsResponse {
  readonly models: ModelInfo[];
}

// ---------------------------------------------------------------------------
// Generations Types
// ---------------------------------------------------------------------------

/** Query parameters for listing generations. */
export interface ListGenerationsParams {
  readonly query?: string;
  readonly page?: number;
  readonly page_size?: number;
}

// ---------------------------------------------------------------------------
// Web Tools Types
// ---------------------------------------------------------------------------

/** Request to fetch a URL. */
export interface WebFetchRequest {
  readonly url: string;
}

/** Response from fetching a URL. */
export interface WebFetchResponse {
  readonly content: string;
}

/** Request to search the web. */
export interface WebSearchRequest {
  readonly query: string;
}

/** A single web search result. */
export interface WebSearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

/** Response from a web search. */
export interface WebSearchResponse {
  readonly results: WebSearchResult[];
}
