// =============================================================================
// Task API SDK - TypeScript Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// ApiError class
// -----------------------------------------------------------------------------

/** Error class for API request failures */
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

// -----------------------------------------------------------------------------
// Error types
// -----------------------------------------------------------------------------

/** Error detail information */
export interface ErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/** Standard error response wrapper */
export interface ErrorResponse {
  readonly error: ErrorDetail;
}

// -----------------------------------------------------------------------------
// Chat types
// -----------------------------------------------------------------------------

/** A function call in a chat completion */
export interface ChatFunctionCall {
  readonly name?: string;
  readonly arguments?: string;
}

/** A tool call within a chat message */
export interface ChatToolCall {
  readonly id?: string;
  readonly type?: string;
  readonly function?: ChatFunctionCall;
}

/** A message in a chat conversation */
export interface ChatMessage {
  readonly role?: string;
  readonly content?: string;
  readonly tool_calls?: ChatToolCall[];
}

/** A message in a chat request */
export interface ChatRequestMessage {
  readonly content?: unknown;
  readonly name?: string;
  readonly role?: string;
  readonly tool_call_id?: string;
  readonly tool_calls?: ChatToolCall[];
}

/** Function definition within a chat request tool */
export interface ChatRequestToolFunction {
  readonly description?: string;
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly strict?: boolean;
}

/** A tool definition for a chat request */
export interface ChatRequestTool {
  readonly function?: ChatRequestToolFunction;
  readonly type?: string;
}

/** Stream options for chat completions */
export interface StreamOptions {
  readonly include_usage?: boolean;
}

/** Chat completion request */
export interface ChatRequest {
  readonly frequency_penalty?: number;
  readonly max_tokens?: number;
  readonly messages?: ChatRequestMessage[];
  readonly model?: string;
  readonly n?: number;
  readonly presence_penalty?: number;
  readonly reasoning_effort?: string;
  readonly stop?: unknown;
  readonly stream?: boolean;
  readonly stream_options?: StreamOptions;
  readonly temperature?: number;
  readonly tool_choice?: unknown;
  readonly tools?: ChatRequestTool[];
  readonly top_p?: number;
  readonly user?: string;
}

/** Token usage for a chat completion */
export interface ChatUsage {
  readonly completion_tokens?: number;
  readonly prompt_tokens?: number;
  readonly total_tokens?: number;
}

/** A choice in a chat completion response */
export interface ChatChoice {
  readonly finish_reason?: string;
  readonly index?: number;
  readonly message?: ChatMessage;
}

/** Chat completion response */
export interface ChatResponse {
  readonly choices?: ChatChoice[];
  readonly created?: number;
  readonly id?: string;
  readonly model?: string;
  readonly object?: string;
  readonly system_fingerprint?: string;
  readonly usage?: ChatUsage;
}

/** Delta content in a streaming chat response */
export interface ChatStreamDelta {
  readonly content?: string;
  readonly role?: string;
  readonly tool_calls?: ChatToolCall[];
}

/** A choice in a streaming chat response */
export interface ChatStreamChoice {
  readonly delta?: ChatStreamDelta;
  readonly finish_reason?: string | null;
  readonly index?: number;
}

/** A chunk in a streaming chat response */
export interface ChatStreamChunk {
  readonly choices?: ChatStreamChoice[];
  readonly created?: number;
  readonly id?: string;
  readonly model?: string;
  readonly object?: string;
  readonly system_fingerprint?: string;
  readonly usage?: ChatUsage | null;
}

// -----------------------------------------------------------------------------
// Embeddings types
// -----------------------------------------------------------------------------

/** A single embedding data item */
export interface EmbeddingsDataItem {
  readonly embedding?: number[];
  readonly index?: number;
  readonly object?: string;
}

/** Embeddings request */
export interface EmbeddingsRequest {
  readonly dimensions?: number;
  readonly encoding_format?: string;
  readonly input: unknown;
  readonly model?: string;
}

/** Usage information for embeddings */
export interface EmbeddingsUsageInfo {
  readonly prompt_tokens?: number;
  readonly total_tokens?: number;
}

/** Embeddings response */
export interface EmbeddingsResponse {
  readonly data?: EmbeddingsDataItem[];
  readonly model?: string;
  readonly object?: string;
  readonly usage?: EmbeddingsUsageInfo;
}

// -----------------------------------------------------------------------------
// Function types
// -----------------------------------------------------------------------------

/** Guard information for input/output guardrails */
export interface GuardInfo {
  readonly type: string;
  readonly flagged: boolean;
  readonly findings?: unknown[];
}

/** Guardrail configuration */
export interface GuardrailConfig {
  readonly type: string;
  readonly action?: string;
  readonly check?: string;
  readonly custom_patterns?: string[];
  readonly model?: string;
  readonly presets?: string[];
  readonly replacement?: string;
}

/** Hints for function execution */
export interface Hints {
  readonly input_guardrails?: GuardrailConfig[];
  readonly instructions?: string;
  readonly max_tokens?: number;
  readonly model?: string;
  readonly output_guardrails?: GuardrailConfig[];
  readonly prefer?: string;
  readonly reasoning_effort?: string;
  readonly stream?: boolean;
  readonly temperature?: number;
}

/** Tool definition for functions */
export interface Tool {
  readonly name: string;
  readonly parameters: Record<string, unknown>;
  readonly description?: string;
}

/** Usage information for token consumption */
export interface UsageInfo {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_creation_1h_tokens?: number;
  readonly cache_creation_tokens?: number;
  readonly cache_read_tokens?: number;
  readonly reasoning_tokens?: number;
}

/** Response metadata for function execution */
export interface ResponseMeta {
  readonly function_name: string;
  readonly script_cached: boolean;
  readonly execution_ms: number;
  readonly llm_calls: number;
  readonly tts_calls: number;
  readonly image_gen_calls: number;
  readonly generation_ms?: number;
  readonly guards?: GuardInfo[];
  readonly model_warnings?: string[];
  readonly models_used?: string[];
  readonly usage?: UsageInfo;
}

/** Run function request body */
export interface RunRequest {
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
  readonly input: Record<string, unknown>;
  readonly hints?: Hints;
  readonly parent_span_id?: string;
  readonly tools?: Tool[];
}

/** Run function response body */
export interface RunResponse {
  readonly output: unknown;
  readonly meta?: ResponseMeta;
}

/** Reasoning configuration */
export interface ReasoningConfig {
  readonly effort?: string;
  readonly summary?: string;
}

/** Function information summary */
export interface FunctionInfo {
  readonly name: string;
  readonly schema_hash: string;
  readonly generated_at: string;
  readonly hit_count: number;
  readonly has_script: boolean;
}

/** Detailed function information including source */
export interface FunctionDetails {
  readonly name: string;
  readonly schema_hash: string;
  readonly generated_at: string;
  readonly hit_count: number;
  readonly source: string;
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
}

/** Function revision information */
export interface FunctionRevision {
  readonly revision_id: number;
  readonly source: string;
  readonly schema_hash: string;
  readonly created_at: string;
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
}

/** Revision summary information */
export interface RevisionInfo {
  readonly revision_id: number;
  readonly created_at: string;
  readonly schema_hash: string;
  readonly is_current: boolean;
}

/** Update function request body */
export interface UpdateFunctionRequest {
  readonly source: string;
}

/** Realtime function creation request */
export interface RealtimeCreateRequest {
  readonly instructions: string;
  readonly model?: string;
  readonly provider?: string;
  readonly tools?: Tool[];
  readonly voice?: string;
}

/** Realtime function creation response */
export interface RealtimeCreateResponse {
  readonly name: string;
  readonly script: string;
  readonly cached: boolean;
  readonly reasoning?: string;
}

// -----------------------------------------------------------------------------
// Interactions types (Google-compatible)
// -----------------------------------------------------------------------------

/** Error in an interaction response */
export interface InteractionsError {
  readonly code: string;
  readonly message: string;
}

/** Function declaration for interactions */
export interface InteractionsFunction {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
}

/** Output item in an interaction response */
export interface InteractionsOutput {
  readonly type: string;
  readonly args?: Record<string, unknown>;
  readonly data?: string;
  readonly id?: string;
  readonly mime_type?: string;
  readonly name?: string;
  readonly summary?: string;
  readonly text?: string;
  readonly thought?: string;
}

/** Tool definition for interactions */
export interface InteractionsTool {
  readonly type?: string;
  readonly function_declarations?: InteractionsFunction[];
}

/** Usage information for interactions */
export interface InteractionsUsage {
  readonly total_tokens: number;
}

/** Interactions request body */
export interface InteractionsRequest {
  readonly agent: string;
  readonly input: unknown;
  readonly model?: string;
  readonly previous_interaction_id?: string;
  readonly tools?: InteractionsTool[];
}

/** Interactions response body */
export interface InteractionsResponse {
  readonly id: string;
  readonly outputs: InteractionsOutput[];
  readonly status: string;
  readonly agent?: string;
  readonly error?: InteractionsError;
  readonly input?: unknown;
  readonly model?: string;
  readonly previous_interaction_id?: string;
  readonly usage?: InteractionsUsage;
}

// -----------------------------------------------------------------------------
// Messages types (Anthropic-compatible)
// -----------------------------------------------------------------------------

/** A message in a messages request */
export interface MessagesMessage {
  readonly role: string;
  readonly content: unknown;
}

/** Tool definition for messages */
export interface MessagesTool {
  readonly name: string;
  readonly input_schema: Record<string, unknown>;
  readonly description?: string;
}

/** Usage information for messages */
export interface MessagesUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
}

/** Messages request body */
export interface MessagesRequest {
  readonly model: string;
  readonly messages: MessagesMessage[];
  readonly max_tokens: number;
  readonly stop_sequences?: string[];
  readonly stream?: boolean;
  readonly system?: unknown;
  readonly temperature?: number;
  readonly tool_choice?: unknown;
  readonly tools?: MessagesTool[];
  readonly top_k?: number;
  readonly top_p?: number;
}

/** A content block in a messages response */
export interface MessagesResponseBlock {
  readonly type: string;
  readonly id?: string;
  readonly input?: unknown;
  readonly name?: string;
  readonly text?: string;
}

/** Messages response body */
export interface MessagesResponse {
  readonly id: string;
  readonly type: string;
  readonly role: string;
  readonly content: MessagesResponseBlock[];
  readonly model: string;
  readonly stop_reason: string;
  readonly stop_sequence: string;
  readonly usage: MessagesUsage;
}

// -----------------------------------------------------------------------------
// Responses types (OpenAI Responses API compatible)
// -----------------------------------------------------------------------------

/** Error in a responses response */
export interface ResponsesError {
  readonly code: string;
  readonly message: string;
}

/** Content item in a responses output */
export interface ResponsesOutputContent {
  readonly type: string;
  readonly annotations?: unknown[];
  readonly text?: string;
}

/** Output item in a responses response */
export interface ResponsesOutputItem {
  readonly type: string;
  readonly arguments?: string;
  readonly call_id?: string;
  readonly content?: ResponsesOutputContent[];
  readonly id?: string;
  readonly name?: string;
  readonly role?: string;
  readonly status?: string;
}

/** Tool definition for responses */
export interface ResponsesTool {
  readonly type: string;
  readonly description?: string;
  readonly headers?: Record<string, string>;
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly require_approval?: string;
  readonly server_label?: string;
  readonly server_url?: string;
}

/** Output tokens details for responses usage */
export interface ResponsesOutputTokensDetails {
  readonly reasoning_tokens?: number;
}

/** Usage information for responses */
export interface ResponsesUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
  readonly output_tokens_details?: ResponsesOutputTokensDetails;
}

/** Responses API request body */
export interface ResponsesRequest {
  readonly input: unknown;
  readonly instructions?: string;
  readonly max_output_tokens?: number;
  readonly metadata?: Record<string, unknown>;
  readonly model?: string;
  readonly previous_response_id?: string;
  readonly reasoning?: ReasoningConfig;
  readonly store?: boolean;
  readonly stream?: boolean;
  readonly temperature?: number;
  readonly tool_choice?: unknown;
  readonly tools?: ResponsesTool[];
  readonly top_p?: number;
  readonly user?: string;
}

/** Responses API response body */
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
  readonly instructions?: string;
  readonly max_output_tokens?: number;
  readonly metadata?: Record<string, unknown>;
  readonly output_text?: string;
  readonly previous_response_id?: string;
  readonly reasoning?: ReasoningConfig;
  readonly temperature?: number;
  readonly tools?: ResponsesTool[];
  readonly top_p?: number;
  readonly usage?: ResponsesUsage;
  readonly user?: string;
}

// -----------------------------------------------------------------------------
// Models types
// -----------------------------------------------------------------------------

/** Embedding model parameters */
export interface ModelEmbeddingParams {
  readonly dimensions: number;
  readonly max_input_tokens?: number;
  readonly supports_dimensions?: boolean;
}

/** Image generation model parameters */
export interface ModelImageParams {
  readonly default?: string;
  readonly qualities?: string[];
  readonly sizes?: string[];
  readonly styles?: string[];
}

/** Image edit model parameters */
export interface ModelImageEditParams {
  readonly aspect_ratios?: string[];
  readonly default?: string;
}

/** Realtime model parameters */
export interface ModelRealtimeParams {
  readonly default_voice?: string;
  readonly input_audio_format?: string;
  readonly output_audio_format?: string;
  readonly sample_rate?: number;
  readonly supports_tools?: boolean;
  readonly supports_vad?: boolean;
  readonly voices?: string[];
}

/** Reasoning model parameters */
export interface ModelReasoningParams {
  readonly supported: string[];
  readonly default: string;
}

/** Speech-to-text model parameters */
export interface ModelSttParams {
  readonly default_language?: string;
  readonly formats?: string[];
  readonly languages?: string[];
}

/** Temperature model parameters */
export interface ModelTemperatureParams {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

/** Text-to-speech model parameters */
export interface ModelTtsParams {
  readonly default_voice?: string;
  readonly max_length?: number;
  readonly voices?: string[];
}

/** Video model parameters */
export interface ModelVideoParams {
  readonly aspect_ratios?: string[];
  readonly max_duration?: number;
  readonly max_fps?: number;
  readonly max_frames?: number;
  readonly resolutions?: string[];
  readonly speed_modes?: string[];
  readonly supports_seed?: boolean;
}

/** Model parameters configuration */
export interface ModelParams {
  readonly max_tokens: boolean;
  readonly default_max_tokens: number;
  readonly embedding?: ModelEmbeddingParams;
  readonly image?: ModelImageParams;
  readonly image_edit?: ModelImageEditParams;
  readonly realtime?: ModelRealtimeParams;
  readonly reasoning?: ModelReasoningParams;
  readonly stt?: ModelSttParams;
  readonly temperature?: ModelTemperatureParams;
  readonly tts?: ModelTtsParams;
  readonly video?: ModelVideoParams;
}

/** Model pricing information */
export interface ModelPricing {
  readonly input: number[];
  readonly output: number[];
  readonly cache_creation?: number[];
  readonly cache_creation_1h?: number[];
  readonly cached_input?: number[];
  readonly image_prices?: Record<string, Record<string, number>>;
  readonly price_per_generation?: number;
  readonly price_per_m_chars?: number;
  readonly price_per_minute?: number;
  readonly price_per_second?: number;
  readonly thresholds?: number[];
}

/** Information about a model */
export interface ModelInfo {
  readonly id: string;
  readonly type: string;
  readonly provider: string;
  readonly name: string;
  readonly model_id: string;
  readonly capabilities: string[];
  readonly speed: string;
  readonly cost: number;
  readonly quality: string;
  readonly context_window: number;
  readonly description: string;
  readonly country?: string;
  readonly deprecated_at?: string;
  readonly params?: ModelParams;
  readonly pricing?: ModelPricing;
  readonly region?: string;
  readonly successor?: string;
}

/** Models listing response */
export interface ModelsResponse {
  readonly models: ModelInfo[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

// -----------------------------------------------------------------------------
// Parse types
// -----------------------------------------------------------------------------

/** Parse Starlark request body */
export interface ParseRequest {
  readonly source: string;
}

// -----------------------------------------------------------------------------
// Generation config types
// -----------------------------------------------------------------------------

/** Configuration for a generation */
export interface GenerationConfig {
  readonly source: string;
}

// -----------------------------------------------------------------------------
// Inline endpoint request/response types
// -----------------------------------------------------------------------------

/** Response from listing functions */
export interface ListFunctionsResponse {
  readonly functions?: FunctionInfo[];
}

/** Response from getting a function (same as FunctionDetails) */
export type GetFunctionResponse = FunctionDetails;

/** Request to run a function (same as RunRequest) */
export type RunFunctionRequest = RunRequest;

/** Response from running a function (same as RunResponse) */
export type RunFunctionResponse = RunResponse;

/** Response from updating a function (same as FunctionDetails) */
export type UpdateFunctionResponse = FunctionDetails;

/** Response from listing revisions */
export interface ListRevisionsResponse {
  readonly revisions?: RevisionInfo[];
}

/** Response from getting a revision (same as FunctionRevision) */
export type GetRevisionResponse = FunctionRevision;

/** Response from reverting a revision (same as FunctionDetails) */
export type RevertRevisionResponse = FunctionDetails;

/** Pagination metadata for generations listing */
export interface GenerationsPaginationMeta {
  readonly page?: number;
  readonly page_size?: number;
  readonly total?: number;
  readonly total_pages?: number;
}

/** Response from listing generations */
export interface ListGenerationsResponse {
  readonly data?: Record<string, unknown>[];
  readonly meta?: GenerationsPaginationMeta;
}

/** Response from getting a generation */
export type GetGenerationResponse = Record<string, unknown>;

/** Response from deleting a generation */
export interface DeleteGenerationResponse {
  readonly deleted?: boolean;
}

/** Response from parsing Starlark */
export type ParseStarlarkResponse = Record<string, unknown>;

/** Health check response */
export interface HealthCheckResponse {
  readonly status?: string;
}

