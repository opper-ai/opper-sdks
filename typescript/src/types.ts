// =============================================================================
// Task API TypeScript SDK - Type Definitions
// =============================================================================

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

/** Configuration for the Task API SDK client. */
export interface ClientConfig {
  /** Base URL for the API. Defaults to https://api.opper.ai */
  readonly baseUrl?: string;
  /** API key for authentication. */
  readonly apiKey: string;
  /** Additional headers to include in requests. */
  readonly headers?: Record<string, string>;
}

/** Options for HTTP requests. */
export interface RequestOptions {
  /** Additional headers for this request. */
  readonly headers?: Record<string, string>;
  /** AbortSignal for request cancellation. */
  readonly signal?: AbortSignal;
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
    this.name = 'ApiError';
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
// Chat Types
// ---------------------------------------------------------------------------

/** Function call information within a chat message. */
export interface ChatFunctionCall {
  readonly name: string;
  readonly arguments: string;
}

/** Tool call within a chat message. */
export interface ChatToolCall {
  readonly id: string;
  readonly type: string;
  readonly function: ChatFunctionCall;
  readonly thought_signature?: string;
}

/** Chat message in a response. */
export interface ChatMessage {
  readonly role: string;
  readonly content: string;
  readonly tool_calls?: ChatToolCall[];
}

/** A choice in a chat completion response. */
export interface ChatChoice {
  readonly index: number;
  readonly message: ChatMessage;
  readonly finish_reason: string;
}

/** Token usage information for chat completions. */
export interface ChatUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
}

/** Chat request message. */
export interface ChatRequestMessage {
  readonly role: string;
  /** Content can be a string or structured content. */
  readonly content: unknown;
  readonly name?: string;
  readonly tool_call_id?: string;
  readonly tool_calls?: ChatToolCall[];
}

/** Function definition for a chat request tool. */
export interface ChatRequestToolFunction {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
}

/** Tool definition for a chat request. */
export interface ChatRequestTool {
  readonly type: string;
  readonly function: ChatRequestToolFunction;
}

/** Stream options for chat completions. */
export interface StreamOptions {
  readonly include_usage?: boolean;
}

/** Chat completion request. */
export interface ChatRequest {
  readonly messages: ChatRequestMessage[];
  readonly model?: string;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly max_tokens?: number;
  readonly max_completion_tokens?: number;
  readonly stop?: string[];
  readonly stream?: boolean;
  readonly stream_options?: StreamOptions;
  readonly tools?: ChatRequestTool[];
  readonly tool_choice?: unknown;
  readonly output_schema?: Record<string, unknown>;
  readonly reasoning_effort?: string;
}

/** Chat completion response. */
export interface ChatResponse {
  readonly id: string;
  readonly object: string;
  readonly created: number;
  readonly model: string;
  readonly choices: ChatChoice[];
  readonly usage: ChatUsage;
}

/** Delta content in a streaming chat chunk. */
export interface ChatStreamDelta {
  readonly role?: string;
  readonly content?: string;
  readonly tool_calls?: ChatStreamToolCall[];
}

/** Tool call within a streaming chat delta. */
export interface ChatStreamToolCall {
  readonly index: number;
  readonly id?: string;
  readonly type?: string;
  readonly function?: ChatStreamFunction;
  readonly thought_signature?: string;
}

/** Function details within a streaming tool call. */
export interface ChatStreamFunction {
  readonly name?: string;
  readonly arguments?: string;
}

/** A choice in a streaming chat chunk. */
export interface ChatStreamChoice {
  readonly index: number;
  readonly delta: ChatStreamDelta;
  readonly finish_reason: string | null;
}

/** Streaming chat completion chunk. */
export interface ChatStreamChunk {
  readonly id: string;
  readonly object: string;
  readonly created: number;
  readonly model: string;
  readonly choices: ChatStreamChoice[];
  readonly usage?: ChatUsage;
  readonly cost?: number;
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

/** Configuration for text generation. */
export interface GenerationConfig {
  readonly temperature?: number;
  readonly top_p?: number;
  readonly top_k?: number;
  readonly max_output_tokens?: number;
  readonly thinking_level?: string;
}

/** Guard evaluation result. */
export interface GuardInfo {
  readonly type: string;
  readonly flagged: boolean;
  readonly findings?: unknown[];
}

/** Guardrail configuration. */
export interface GuardrailConfig {
  readonly type: string;
  readonly action?: string;
  readonly applies_to?: string;
  readonly check?: string;
  readonly model?: string;
  readonly presets?: string[];
  readonly custom_patterns?: string[];
  readonly replacement?: string;
}

/** Hints for function execution. */
export interface Hints {
  readonly instructions?: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly prefer?: string;
  readonly reasoning_effort?: string;
  readonly stream?: boolean;
  readonly input_guardrails?: GuardrailConfig[];
  readonly output_guardrails?: GuardrailConfig[];
}

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
  readonly guards?: GuardInfo[];
  readonly models_used?: string[];
  readonly model_warnings?: string[];
}

/** Request to run a function. */
export interface RunRequest {
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
  readonly input: Record<string, unknown>;
  readonly hints?: Hints;
  readonly parent_span_id?: string;
  readonly tools?: Tool[];
}

/** Response from running a function. */
export interface RunResponse {
  readonly output: unknown;
  readonly meta?: ResponseMeta;
}

/** Request to update a function. */
export interface UpdateFunctionRequest {
  readonly source: string;
}

/** Revision info summary. */
export interface RevisionInfo {
  readonly revision_id: number;
  readonly created_at: string;
  readonly schema_hash: string;
  readonly is_current: boolean;
}

/** Reasoning configuration. */
export interface ReasoningConfig {
  readonly effort?: string;
  readonly summary?: string;
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
// Interactions Types (Google-compatible)
// ---------------------------------------------------------------------------

/** Function definition for interactions. */
export interface InteractionsFunction {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
}

/** Tool definition for interactions. */
export interface InteractionsTool {
  readonly function_declarations?: InteractionsFunction[];
}

/** Content part for interactions. */
export interface InteractionsContentPart {
  readonly text?: string;
  readonly inline_data?: InteractionsInlineData;
}

/** Inline data for interactions content. */
export interface InteractionsInlineData {
  readonly mime_type?: string;
  readonly data?: string;
}

/** Content message for interactions. */
export interface InteractionsContent {
  readonly role?: string;
  readonly parts?: InteractionsContentPart[];
}

/** Interactions request. */
export interface InteractionsRequest {
  readonly contents?: InteractionsContent[];
  readonly tools?: InteractionsTool[];
  readonly generation_config?: GenerationConfig;
  readonly system_instruction?: InteractionsContent;
}

/** Interactions output candidate content. */
export interface InteractionsOutput {
  readonly content?: InteractionsContent;
  readonly finish_reason?: string;
}

/** Token usage for interactions. */
export interface InteractionsUsage {
  readonly prompt_token_count?: number;
  readonly candidates_token_count?: number;
  readonly total_token_count?: number;
}

/** Error in interactions response. */
export interface InteractionsError {
  readonly code?: number;
  readonly message?: string;
  readonly status?: string;
}

/** Interactions response. */
export interface InteractionsResponse {
  readonly candidates?: InteractionsOutput[];
  readonly usage_metadata?: InteractionsUsage;
  readonly error?: InteractionsError;
}

// ---------------------------------------------------------------------------
// Messages Types (Anthropic-compatible)
// ---------------------------------------------------------------------------

/** Message in a messages request. */
export interface MessagesMessage {
  readonly role?: string;
  readonly content?: unknown;
}

/** Tool definition for messages. */
export interface MessagesTool {
  readonly name?: string;
  readonly description?: string;
  readonly input_schema?: Record<string, unknown>;
}

/** Messages request. */
export interface MessagesRequest {
  readonly model?: string;
  readonly messages?: MessagesMessage[];
  readonly max_tokens?: number;
  readonly system?: string;
  readonly tools?: MessagesTool[];
  readonly temperature?: number;
  readonly top_p?: number;
  readonly top_k?: number;
  readonly stream?: boolean;
}

/** Response block in a messages response. */
export interface MessagesResponseBlock {
  readonly type?: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: Record<string, unknown>;
}

/** Token usage for messages. */
export interface MessagesUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
}

/** Messages response. */
export interface MessagesResponse {
  readonly id?: string;
  readonly type?: string;
  readonly role?: string;
  readonly content?: MessagesResponseBlock[];
  readonly model?: string;
  readonly stop_reason?: string;
  readonly usage?: MessagesUsage;
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
// Responses Types (OpenAI Responses API compatible)
// ---------------------------------------------------------------------------

/** Error in a responses response. */
export interface ResponsesError {
  readonly code: string;
  readonly message: string;
}

/** Content block within a responses output item. */
export interface ResponsesOutputContent {
  readonly type: string;
  readonly text?: string;
  readonly annotations?: unknown[];
}

/** Output item in a responses response. */
export interface ResponsesOutputItem {
  readonly type: string;
  readonly id?: string;
  readonly role?: string;
  readonly status?: string;
  readonly content?: ResponsesOutputContent[];
  readonly name?: string;
  readonly call_id?: string;
  readonly arguments?: string;
}

/** Tool definition for responses. */
export interface ResponsesTool {
  readonly type: string;
  readonly name?: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
  readonly server_url?: string;
  readonly server_label?: string;
  readonly headers?: Record<string, string>;
  readonly require_approval?: string;
}

/** Output tokens details for responses usage. */
export interface ResponsesOutputTokensDetails {
  readonly reasoning_tokens?: number;
}

/** Token usage for responses. */
export interface ResponsesUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
  readonly output_tokens_details?: ResponsesOutputTokensDetails;
}

/** Responses API request. */
export interface ResponsesRequest {
  readonly input: unknown;
  readonly model?: string;
  readonly instructions?: string;
  readonly tools?: ResponsesTool[];
  readonly tool_choice?: unknown;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly max_output_tokens?: number;
  readonly reasoning?: ReasoningConfig;
  readonly metadata?: Record<string, unknown>;
  readonly store?: boolean;
  readonly stream?: boolean;
  readonly user?: string;
  readonly previous_response_id?: string;
}

/** Responses API response. */
export interface ResponsesResponse {
  readonly id: string;
  readonly object: string;
  readonly created_at: number;
  readonly model: string;
  readonly status: string;
  readonly output: ResponsesOutputItem[];
  readonly error: ResponsesError | null;
  readonly incomplete_details: unknown;
  readonly tool_choice: unknown;
  readonly output_text?: string;
  readonly instructions?: string;
  readonly max_output_tokens?: number;
  readonly metadata?: Record<string, unknown>;
  readonly previous_response_id?: string;
  readonly reasoning?: ReasoningConfig;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly tools?: ResponsesTool[];
  readonly usage?: ResponsesUsage;
  readonly user?: string;
}

// ---------------------------------------------------------------------------
// Parse Types
// ---------------------------------------------------------------------------

/** Request to parse a Starlark script. */
export interface ParseRequest {
  readonly source: string;
  readonly filename?: string;
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

