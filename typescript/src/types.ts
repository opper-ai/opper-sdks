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

/** API error with status code and structured error info. */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    const detail = ApiError.parseDetail(body);
    const msg = detail ? `${status} ${statusText}: ${detail.message}` : `${status} ${statusText}`;
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }

  /** Parsed error detail from the response body, if available. */
  get error(): ErrorDetail | undefined {
    return ApiError.parseDetail(this.body);
  }

  /** @internal */
  static parseDetail(body: unknown): ErrorDetail | undefined {
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as ErrorResponse).error === "object"
    ) {
      const e = (body as ErrorResponse).error;
      if (typeof e.code === "string" && typeof e.message === "string") {
        return e;
      }
    }
    return undefined;
  }
}

/** 400 Bad Request — invalid input or malformed request. */
export class BadRequestError extends ApiError {
  constructor(statusText: string, body: unknown) {
    super(400, statusText, body);
    this.name = "BadRequestError";
  }
}

/** 401 Unauthorized — missing or invalid API key. */
export class AuthenticationError extends ApiError {
  constructor(statusText: string, body: unknown) {
    super(401, statusText, body);
    this.name = "AuthenticationError";
  }
}

/** 404 Not Found — the requested resource does not exist. */
export class NotFoundError extends ApiError {
  constructor(statusText: string, body: unknown) {
    super(404, statusText, body);
    this.name = "NotFoundError";
  }
}

/** 429 Too Many Requests — rate limit exceeded. */
export class RateLimitError extends ApiError {
  constructor(statusText: string, body: unknown) {
    super(429, statusText, body);
    this.name = "RateLimitError";
  }
}

/** 500 Internal Server Error — something went wrong on the server. */
export class InternalServerError extends ApiError {
  constructor(statusText: string, body: unknown) {
    super(500, statusText, body);
    this.name = "InternalServerError";
  }
}

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

/** A JSON Schema or a Standard Schema (Zod, Valibot, ArkType, etc.). */
export type SchemaLike = JsonSchema | import("./schema.js").StandardSchemaV1;

/**
 * Extended model configuration with provider-specific options.
 *
 * @example
 * ```typescript
 * { name: "anthropic/claude-sonnet-4-6", options: { max_tokens: 1000 } }
 * ```
 */
export interface ModelConfig {
  /** Model identifier (e.g. `"openai/gpt-4o"`). */
  readonly name: string;
  /** Provider-specific parameters (temperature, max_tokens, reasoning_effort, etc.). */
  readonly options?: Record<string, unknown>;
  /** Extra HTTP headers to send with requests to this model. */
  readonly extra_headers?: Record<string, string>;
}

/**
 * Model specification: a model identifier string, a {@link ModelConfig} object
 * with provider-specific options, or an array of either for fallback chains.
 *
 * @example
 * ```typescript
 * // Simple string
 * model: "anthropic/claude-sonnet-4-6"
 *
 * // With options
 * model: { name: "anthropic/claude-sonnet-4-6", options: { max_tokens: 500 } }
 *
 * // Fallback chain — models tried in order on retriable errors
 * model: ["anthropic/claude-sonnet-4-6", { name: "openai/gpt-4o", options: { temperature: 0.7 } }]
 * ```
 */
export type Model = string | ModelConfig | (string | ModelConfig)[];

/** Tool definition for function execution. */
export interface Tool {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: SchemaLike;
  readonly type?: string;
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

/** An async operation that is still in progress. */
export interface PendingOperation {
  readonly id: string;
  readonly status_url: string;
  readonly type: string;
}

/** Status of an async artifact generation. */
export interface ArtifactStatus {
  readonly id: string;
  readonly status: "processing" | "completed" | "failed";
  readonly url?: string;
  readonly mime_type?: string;
  readonly error?: string;
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
  readonly message?: string;
  readonly status?: string;
  readonly pending_operations?: PendingOperation[];
}

/** Request to run a function. */
export interface RunRequest {
  /** JSON Schema or Standard Schema describing the input shape. Defaults to text when omitted. */
  readonly input_schema?: SchemaLike;
  /** JSON Schema or Standard Schema describing the expected output shape. Defaults to text when omitted. */
  readonly output_schema?: SchemaLike;
  /** The input data to send to the function. */
  readonly input: JsonValue;
  /** Model to use — a string, a {@link ModelConfig} with provider-specific options, or a fallback chain. */
  readonly model?: Model;
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

/** Request to run a function with a Standard Schema for output type inference. */
export interface SchemaRunRequest<TOutput = unknown> {
  /** Standard Schema (Zod, Valibot, ArkType, etc.) or raw JSON Schema defining the expected output shape. */
  // biome-ignore lint/suspicious/noExplicitAny: `any` allows accepting schemas with any input type
  readonly output_schema: import("./schema.js").StandardSchemaV1<any, TOutput> | JsonSchema;
  /** The input data to send to the function. */
  readonly input: JsonValue;
  /** JSON Schema or Standard Schema describing the input shape. Defaults to text when omitted. */
  readonly input_schema?: SchemaLike;
  /** Model to use — a string, a {@link ModelConfig} with provider-specific options, or a fallback chain. */
  readonly model?: Model;
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

/** Response from running a function. */
export interface RunResponse<T = unknown> {
  readonly data: T;
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
export interface CompleteChunk<T = unknown> {
  readonly type: "complete";
  readonly data: T;
  readonly meta?: ResponseMeta;
}

/** SSE stream chunk from /stream endpoint. */
export type StreamChunk<T = unknown> =
  | ContentChunk
  | ToolCallStartChunk
  | ToolCallDeltaChunk
  | DoneChunk
  | ErrorChunk
  | CompleteChunk<T>;

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
  readonly aliases?: string[];
  readonly capabilities?: Record<string, unknown>;
  readonly pricing?: Record<string, unknown>;
  readonly parameters?: Record<string, unknown>;
  /** Date when this model will be or was retired. */
  readonly retired_at?: string;
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

// ---------------------------------------------------------------------------
// Knowledge Base Types (v2 API)
// ---------------------------------------------------------------------------

/** Paginated response wrapper. */
export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly meta: { readonly total_count: number };
}

/** Request to create a knowledge base. */
export interface CreateKnowledgeBaseRequest {
  readonly name: string;
  readonly embedding_model?: string;
}

/** Response from creating a knowledge base. */
export interface CreateKnowledgeBaseResponse {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly embedding_model: string;
}

/** Knowledge base summary in list responses. */
export interface KnowledgeBaseInfo {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly embedding_model: string;
}

/** Detailed knowledge base response including document count. */
export interface GetKnowledgeBaseResponse {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly embedding_model: string;
  readonly count: number;
}

/** Text processing configuration for chunking. */
export interface TextProcessingConfiguration {
  readonly chunk_size?: number;
  readonly chunk_overlap?: number;
}

/** Request to add a document to a knowledge base. */
export interface AddDocumentRequest {
  readonly content: string;
  readonly key?: string;
  readonly metadata?: Record<string, unknown>;
  readonly configuration?: TextProcessingConfiguration;
}

/** Response from adding a document. */
export interface AddDocumentResponse {
  readonly id: string;
  readonly key: string;
  readonly metadata?: Record<string, unknown>;
}

/** Filter operation for knowledge base queries. */
export type FilterOp = "=" | "!=" | ">" | "<" | "in";

/** A filter condition for knowledge base queries. */
export interface KnowledgeBaseFilter {
  readonly field: string;
  readonly operation: FilterOp;
  readonly value: string | number | (string | number)[];
}

/** Request to query a knowledge base. */
export interface QueryKnowledgeBaseRequest {
  readonly query: string;
  readonly prefilter_limit?: number;
  readonly top_k?: number;
  readonly filters?: KnowledgeBaseFilter[];
  readonly rerank?: boolean;
  readonly parent_span_id?: string;
}

/** A single query result from a knowledge base. */
export interface QueryKnowledgeBaseResponse {
  readonly id: string;
  readonly key: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly score: number;
}

/** A document segment. */
export interface DocumentSegment {
  readonly id: string;
  readonly content: string;
}

/** Response from getting a document by key. */
export interface GetDocumentResponse {
  readonly id: string;
  readonly key: string;
  readonly segments: DocumentSegment[];
  readonly metadata?: Record<string, unknown>;
}

/** Request to delete documents from a knowledge base. */
export interface DeleteDocumentsRequest {
  readonly filters?: KnowledgeBaseFilter[];
}

/** Response from deleting documents. */
export interface DeleteDocumentsResponse {
  readonly deleted_count: number;
}

/** Response from getting a presigned upload URL. */
export interface GetUploadUrlResponse {
  readonly url: string;
  readonly fields: Record<string, unknown>;
  readonly id: string;
}

/** Request to register a file after S3 upload. */
export interface RegisterFileUploadRequest {
  readonly filename: string;
  readonly file_id: string;
  readonly content_type: string;
  readonly configuration?: TextProcessingConfiguration;
  readonly metadata?: Record<string, unknown>;
}

/** Response from registering a file upload. */
export interface RegisterFileUploadResponse {
  readonly id: string;
  readonly key: string;
  readonly original_filename: string;
  readonly document_id: number;
  readonly metadata?: Record<string, unknown>;
}

/** Response from direct file upload. */
export interface UploadFileResponse {
  readonly id: string;
  readonly key: string;
  readonly original_filename: string;
  readonly document_id: number;
  readonly metadata?: Record<string, unknown>;
}

/** File information in list responses. */
export interface ListFilesResponse {
  readonly id: string;
  readonly original_filename: string;
  readonly size: number;
  readonly status: string;
  readonly document_id: number;
  readonly metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Trace Types
// ---------------------------------------------------------------------------

/** Query parameters for listing traces. */
export interface ListTracesParams {
  /** Max items to return (default 100, max 100). */
  readonly limit?: number;
  /** Number of items to skip (default 0). */
  readonly offset?: number;
  /** Filter by trace name (case-insensitive substring match). */
  readonly name?: string;
}

/** A trace item in list responses. */
export interface ListTracesItem {
  readonly id: string;
  readonly name?: string;
  readonly span_count: number;
  readonly start_time?: string;
  readonly end_time?: string;
  readonly duration_ms?: number;
  readonly status?: string;
}

/** Response from listing traces. */
export interface ListTracesResponse {
  readonly data: ListTracesItem[];
  readonly meta: { readonly total_count: number };
}

/** Span details within a trace. */
export interface TraceSpan {
  readonly id: string;
  readonly trace_id: string;
  readonly name: string;
  readonly parent_id?: string;
  readonly type?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: string;
  readonly start_time?: string;
  readonly end_time?: string;
  readonly created_at?: string;
  readonly status?: string;
  readonly meta?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: Record<string, unknown>;
}

/** Response from getting a single trace with all its spans. */
export interface GetTraceResponse {
  readonly id: string;
  readonly name?: string;
  readonly span_count: number;
  readonly spans: TraceSpan[];
  readonly start_time?: string;
  readonly end_time?: string;
  readonly duration_ms?: number;
  readonly status?: string;
}

/** Response from getting a single span. */
export interface GetSpanResponse {
  readonly id: string;
  readonly trace_id: string;
  readonly name: string;
  readonly parent_id?: string;
  readonly type?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: string;
  readonly start_time?: string;
  readonly end_time?: string;
  readonly status?: string;
  readonly meta?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: Record<string, unknown>;
}
