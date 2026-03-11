// =============================================================================
// Opper SDK - Type Definitions
// =============================================================================

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
  readonly parameters: Record<string, unknown>;
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
}

/** Request to run a function. */
export interface RunRequest {
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
  readonly input: Record<string, unknown>;
  readonly model?: string;
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly reasoning_effort?: string;
  readonly parent_span_id?: string;
  readonly tools?: Tool[];
}

/** Response from running a function. */
export interface RunResponse {
  readonly output: unknown;
  readonly meta?: ResponseMeta;
}

/** SSE stream chunk from /stream endpoint. */
export interface StreamChunk {
  readonly type: string;
  readonly delta: string;
  readonly error: string;
  readonly tool_call_index: number;
  readonly tool_call_id: string;
  readonly tool_call_name: string;
  readonly tool_call_args: string;
  readonly tool_call_thought_sig: string;
  readonly usage: UsageInfo;
}

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
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
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
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
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
  readonly input: unknown;
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
  readonly id?: string;
  readonly name?: string;
  readonly provider?: string;
  readonly capabilities?: Record<string, unknown>;
  readonly pricing?: Record<string, unknown>;
  readonly parameters?: Record<string, unknown>;
}

/** Response containing list of models. */
export interface ModelsResponse {
  readonly models?: ModelInfo[];
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
