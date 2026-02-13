// =============================================================================
// Task API SDK - TypeScript Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Client Configuration
// -----------------------------------------------------------------------------

/** Configuration options for the Task API client. */
export interface ClientConfig {
  /** Base URL of the API server. */
  baseUrl?: string;
  /** API key for Bearer authentication. */
  apiKey: string;
  /** Additional headers to include in every request. */
  headers?: Record<string, string>;
}

// -----------------------------------------------------------------------------
// API Error
// -----------------------------------------------------------------------------

/** Error class for API request failures. */
export class ApiError extends Error {
  /** HTTP status code. */
  readonly status: number;
  /** HTTP status text. */
  readonly statusText: string;
  /** Response body, if available. */
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
// Request Options
// -----------------------------------------------------------------------------

/** Options that can be passed to individual API requests. */
export interface RequestOptions {
  /** Additional headers for this specific request. */
  headers?: Record<string, string>;
  /** AbortSignal to cancel the request. */
  signal?: AbortSignal;
}

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

/** Detailed error information. */
export interface ErrorDetail {
  readonly code: string;
  readonly message: string;
  /** Additional details about the error. */
  readonly details?: unknown;
}

/** Standard error response envelope. */
export interface ErrorResponse {
  readonly error: ErrorDetail;
}

// -----------------------------------------------------------------------------
// Chat Types
// -----------------------------------------------------------------------------

/** Function call information within a chat tool call. */
export interface ChatFunctionCall {
  readonly name: string;
  readonly arguments: string;
}

/** Tool call in a chat response message. */
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

/** A single choice in a chat completion response. */
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

/** Chat completion response. */
export interface ChatResponse {
  readonly id: string;
  readonly object: string;
  readonly created: number;
  readonly model: string;
  readonly choices: ChatChoice[];
  readonly usage: ChatUsage;
}

/** Stream options for chat requests. */
export interface StreamOptions {
  include_usage?: boolean;
}

/** Function call information in a chat request tool. */
export interface ChatRequestToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/** Tool definition for a chat request. */
export interface ChatRequestTool {
  type: string;
  function: ChatRequestToolFunction;
}

/** Message in a chat completion request. */
export interface ChatRequestMessage {
  role: string;
  /** Message content. Can be a string or structured content. */
  content: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

/** Chat completion request body. */
export interface ChatRequest {
  messages: ChatRequestMessage[];
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stop?: string[];
  stream?: boolean;
  stream_options?: StreamOptions;
  tools?: ChatRequestTool[];
  /** Tool choice configuration. Can be a string or object. */
  tool_choice?: unknown;
  output_schema?: Record<string, unknown>;
  reasoning_effort?: string;
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
  readonly function?: ChatStreamToolCallFunction;
  readonly thought_signature?: string;
}

/** Function info within a streaming tool call. */
export interface ChatStreamToolCallFunction {
  readonly name?: string;
  readonly arguments?: string;
}

/** A single choice in a streaming chat chunk. */
export interface ChatStreamChoice {
  readonly index: number;
  readonly delta: ChatStreamDelta;
  readonly finish_reason: string;
}

/** Streaming chat completion chunk. */
export interface ChatStreamChunk {
  readonly id: string;
  readonly object: string;
  readonly created: number;
  readonly model: string;
  readonly choices: ChatStreamChoice[];
  readonly usage?: ChatUsage;
}

// -----------------------------------------------------------------------------
// Embeddings Types
// -----------------------------------------------------------------------------

/** A single embedding data item. */
export interface EmbeddingsDataItem {
  readonly object: string;
  readonly index: number;
  readonly embedding: number[];
}

/** Usage information for embeddings requests. */
export interface EmbeddingsUsageInfo {
  readonly prompt_tokens: number;
  readonly total_tokens: number;
}

/** Embeddings request body. */
export interface EmbeddingsRequest {
  /** Input text or array of texts to embed. */
  input: unknown;
  model: string;
  encoding_format?: string;
  dimensions?: number;
  user?: string;
}

/** Embeddings response. */
export interface EmbeddingsResponse {
  readonly object: string;
  readonly data: EmbeddingsDataItem[];
  readonly model: string;
  readonly usage: EmbeddingsUsageInfo;
}

// -----------------------------------------------------------------------------
// Function Types
// -----------------------------------------------------------------------------

/** Guardrail configuration for a function. */
export interface GuardrailConfig {
  type: string;
  action?: string;
  check?: string;
  model?: string;
  presets?: string[];
  custom_patterns?: string[];
  replacement?: string;
}

/** Guard evaluation result. */
export interface GuardInfo {
  readonly type: string;
  readonly flagged: boolean;
  readonly findings?: unknown[];
}

/** Hints for function execution configuration. */
export interface Hints {
  model?: string;
  instructions?: string;
  temperature?: number;
  max_tokens?: number;
  prefer?: string;
  reasoning_effort?: string;
  stream?: boolean;
  input_guardrails?: GuardrailConfig[];
  output_guardrails?: GuardrailConfig[];
}

/** Detailed function information. */
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

/** Function revision details. */
export interface FunctionRevision {
  readonly revision_id: number;
  readonly source: string;
  readonly schema_hash: string;
  readonly created_at: string;
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
}

/** Revision summary information. */
export interface RevisionInfo {
  readonly revision_id: number;
  readonly created_at: string;
  readonly schema_hash: string;
  readonly is_current: boolean;
}

/** Tool definition for function execution. */
export interface Tool {
  name: string;
  parameters: Record<string, unknown>;
  description?: string;
}

/** Token usage information for function execution. */
export interface UsageInfo {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly reasoning_tokens?: number;
  readonly cache_creation_tokens?: number;
  readonly cache_creation_1h_tokens?: number;
  readonly cache_read_tokens?: number;
}

/** Metadata about a function execution response. */
export interface ResponseMeta {
  readonly function_name: string;
  readonly script_cached: boolean;
  readonly execution_ms: number;
  readonly llm_calls: number;
  readonly tts_calls: number;
  readonly image_gen_calls: number;
  readonly generation_ms?: number;
  readonly models_used?: string[];
  readonly model_warnings?: string[];
  readonly guards?: GuardInfo[];
  readonly usage?: UsageInfo;
}

/** Request body for running a function. */
export interface RunRequest {
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  input: Record<string, unknown>;
  hints?: Hints;
  parent_span_id?: string;
  tools?: Tool[];
}

/** Response from running a function. */
export interface RunResponse {
  /** The function output value. */
  readonly output: unknown;
  readonly meta?: ResponseMeta;
}

/** Request body for updating a function. */
export interface UpdateFunctionRequest {
  source: string;
}

/** Request body for creating a realtime function session. */
export interface RealtimeCreateRequest {
  instructions: string;
  model?: string;
  provider?: string;
  voice?: string;
  tools?: RealtimeCreateTool[];
}

/** Tool definition for realtime function creation. */
export interface RealtimeCreateTool {
  name: string;
  parameters: Record<string, unknown>;
  description?: string;
}

/** Response from creating a realtime function session. */
export interface RealtimeCreateResponse {
  readonly name: string;
  readonly script: string;
  readonly cached: boolean;
  readonly reasoning?: string;
}

// -----------------------------------------------------------------------------
// Generation Types
// -----------------------------------------------------------------------------

/** Generation configuration parameters. */
export interface GenerationConfig {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_output_tokens?: number;
  thinking_level?: string;
}

// -----------------------------------------------------------------------------
// Interactions Types (Google-compatible)
// -----------------------------------------------------------------------------

/** Error in an interaction response. */
export interface InteractionsError {
  readonly code: string;
  readonly message: string;
}

/** Function declaration for interactions. */
export interface InteractionsFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/** Output item from an interaction. */
export interface InteractionsOutput {
  readonly type: string;
  readonly text?: string;
  readonly thought?: string;
  readonly data?: string;
  readonly mime_type?: string;
  readonly name?: string;
  readonly args?: Record<string, unknown>;
  readonly id?: string;
  readonly summary?: string;
}

/** Tool definition for interactions. */
export interface InteractionsTool {
  type?: string;
  function_declarations?: InteractionsFunction[];
}

/** Usage information for interactions. */
export interface InteractionsUsage {
  readonly total_tokens: number;
}

/** Interactions request body. */
export interface InteractionsRequest {
  /** Input value for the interaction. */
  input: unknown;
  model?: string;
  agent?: string;
  system_instruction?: string;
  stream?: boolean;
  store?: boolean;
  background?: boolean;
  previous_interaction_id?: string;
  generation_config?: GenerationConfig;
  response_format?: Record<string, unknown>;
  tools?: InteractionsTool[];
}

/** Interactions response. */
export interface InteractionsResponse {
  readonly id: string;
  readonly outputs: InteractionsOutput[];
  readonly status: string;
  /** Input value echoed back. */
  readonly input?: unknown;
  readonly model?: string;
  readonly agent?: string;
  readonly previous_interaction_id?: string;
  readonly usage?: InteractionsUsage;
  readonly error?: InteractionsError;
}

// -----------------------------------------------------------------------------
// Messages Types (Anthropic-compatible)
// -----------------------------------------------------------------------------

/** Message in a messages request. */
export interface MessagesMessage {
  role: string;
  /** Message content. Can be a string or structured content. */
  content: unknown;
}

/** Tool definition for messages API. */
export interface MessagesTool {
  name: string;
  input_schema: Record<string, unknown>;
  description?: string;
}

/** Messages request body. */
export interface MessagesRequest {
  model: string;
  messages: MessagesMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  /** System prompt. Can be a string or structured content. */
  system?: unknown;
  tools?: MessagesTool[];
  /** Tool choice configuration. */
  tool_choice?: unknown;
}

/** Content block in a messages response. */
export interface MessagesResponseBlock {
  readonly type: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  /** Tool use input. */
  readonly input?: unknown;
}

/** Usage information for messages API. */
export interface MessagesUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
}

/** Messages response. */
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
// Model Types
// -----------------------------------------------------------------------------

/** Temperature parameter configuration. */
export interface ModelTemperatureParams {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

/** Reasoning parameter configuration. */
export interface ModelReasoningParams {
  readonly supported: string[];
  readonly default: string;
}

/** Embedding parameter configuration. */
export interface ModelEmbeddingParams {
  readonly dimensions: number;
  readonly max_input_tokens?: number;
  readonly supports_dimensions?: boolean;
}

/** Image generation parameter configuration. */
export interface ModelImageParams {
  readonly default?: string;
  readonly qualities?: string[];
  readonly sizes?: string[];
  readonly styles?: string[];
}

/** Image edit parameter configuration. */
export interface ModelImageEditParams {
  readonly default?: string;
  readonly aspect_ratios?: string[];
}

/** Realtime parameter configuration. */
export interface ModelRealtimeParams {
  readonly default_voice?: string;
  readonly input_audio_format?: string;
  readonly output_audio_format?: string;
  readonly sample_rate?: number;
  readonly supports_tools?: boolean;
  readonly supports_vad?: boolean;
  readonly voices?: string[];
}

/** Text-to-speech parameter configuration. */
export interface ModelTtsParams {
  readonly default_voice?: string;
  readonly max_length?: number;
  readonly voices?: string[];
}

/** Speech-to-text parameter configuration. */
export interface ModelSttParams {
  readonly default_language?: string;
  readonly formats?: string[];
  readonly languages?: string[];
}

/** Video generation parameter configuration. */
export interface ModelVideoParams {
  readonly aspect_ratios?: string[];
  readonly max_duration?: number;
  readonly max_fps?: number;
  readonly max_frames?: number;
  readonly resolutions?: string[];
  readonly speed_modes?: string[];
  readonly supports_seed?: boolean;
}

/** Model-specific parameters and capabilities. */
export interface ModelParams {
  readonly max_tokens: boolean;
  readonly default_max_tokens: number;
  readonly temperature?: ModelTemperatureParams;
  readonly reasoning?: ModelReasoningParams;
  readonly embedding?: ModelEmbeddingParams;
  readonly image?: ModelImageParams;
  readonly image_edit?: ModelImageEditParams;
  readonly realtime?: ModelRealtimeParams;
  readonly tts?: ModelTtsParams;
  readonly stt?: ModelSttParams;
  readonly video?: ModelVideoParams;
}

/** Model pricing information. */
export interface ModelPricing {
  readonly input: number[];
  readonly output: number[];
  readonly cached_input?: number[];
  readonly cache_creation?: number[];
  readonly cache_creation_1h?: number[];
  readonly thresholds?: number[];
  readonly price_per_generation?: number;
  readonly price_per_m_chars?: number;
  readonly price_per_minute?: number;
  readonly price_per_second?: number;
  readonly image_prices?: Record<string, Record<string, number>>;
}

/** Information about a model. */
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
  readonly region?: string;
  readonly successor?: string;
  readonly deprecated_at?: string;
  readonly params?: ModelParams;
  readonly pricing?: ModelPricing;
}

/** Response from listing models. */
export interface ModelsResponse {
  readonly models: ModelInfo[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

// -----------------------------------------------------------------------------
// Parse Types
// -----------------------------------------------------------------------------

/** Request body for parsing Starlark source. */
export interface ParseRequest {
  source: string;
}

// -----------------------------------------------------------------------------
// Reasoning Config
// -----------------------------------------------------------------------------

/** Configuration for reasoning behavior. */
export interface ReasoningConfig {
  effort?: string;
  summary?: string;
}

// -----------------------------------------------------------------------------
// Responses Types (OpenAI Responses API compatible)
// -----------------------------------------------------------------------------

/** Error in a responses API response. */
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

/** Output item in a responses API response. */
export interface ResponsesOutputItem {
  readonly type: string;
  readonly id?: string;
  readonly role?: string;
  readonly status?: string;
  readonly content?: ResponsesOutputContent[];
  readonly name?: string;
  readonly arguments?: string;
  readonly call_id?: string;
}

/** Tool definition for the responses API. */
export interface ResponsesTool {
  type: string;
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  server_url?: string;
  server_label?: string;
  headers?: Record<string, string>;
  require_approval?: string;
}

/** Output tokens detail breakdown. */
export interface ResponsesOutputTokensDetails {
  readonly reasoning_tokens?: number;
}

/** Usage information for the responses API. */
export interface ResponsesUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
  readonly output_tokens_details?: ResponsesOutputTokensDetails;
}

/** Responses API request body. */
export interface ResponsesRequest {
  /** Input for the response. Can be a string or structured input. */
  input: unknown;
  model?: string;
  instructions?: string;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  stream?: boolean;
  store?: boolean;
  previous_response_id?: string;
  reasoning?: ReasoningConfig;
  tools?: ResponsesTool[];
  /** Tool choice configuration. Can be a string or object. */
  tool_choice?: unknown;
  metadata?: Record<string, unknown>;
  user?: string;
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
  /** Incomplete details, if the response was truncated. */
  readonly incomplete_details: unknown;
  /** Tool choice that was used. */
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

