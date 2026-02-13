// =============================================================================
// Types for Task API SDK
// =============================================================================

// -----------------------------------------------------------------------------
// ApiError class
// -----------------------------------------------------------------------------

/** Error thrown by API client on non-OK responses */
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
// Error schemas
// -----------------------------------------------------------------------------

/** Error detail object */
export interface ErrorDetail {
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
}

/** Error response wrapper */
export interface ErrorResponse {
  readonly error: ErrorDetail;
}

// -----------------------------------------------------------------------------
// Chat types
// -----------------------------------------------------------------------------

/** Function call in a chat message */
export interface ChatFunctionCall {
  readonly arguments?: string;
  readonly name?: string;
}

/** Tool call in a chat message */
export interface ChatToolCall {
  readonly function?: ChatFunctionCall;
  readonly id?: string;
  readonly type?: string;
}

/** Chat message object */
export interface ChatMessage {
  readonly content?: string | null;
  readonly function_call?: ChatFunctionCall;
  readonly role?: string;
  readonly tool_calls?: ChatToolCall[];
}

/** A choice in a chat completion response */
export interface ChatChoice {
  readonly finish_reason?: string;
  readonly index?: number;
  readonly message?: ChatMessage;
}

/** Token usage information for chat completions */
export interface ChatUsage {
  readonly completion_tokens?: number;
  readonly prompt_tokens?: number;
  readonly total_tokens?: number;
}

/** Chat request message */
export interface ChatRequestMessage {
  content: string;
  name?: string;
  role: string;
  tool_call_id?: string;
}

/** Function definition for a chat request tool */
export interface ChatRequestToolFunction {
  description?: string;
  name: string;
  parameters?: Record<string, unknown>;
}

/** Tool definition for a chat request */
export interface ChatRequestTool {
  function: ChatRequestToolFunction;
  type: string;
}

/** Stream options for chat completions */
export interface StreamOptions {
  include_usage?: boolean;
}

/** Chat completion request body */
export interface ChatRequest {
  frequency_penalty?: number;
  max_tokens?: number;
  messages: ChatRequestMessage[];
  model: string;
  n?: number;
  presence_penalty?: number;
  stream?: boolean;
  stream_options?: StreamOptions;
  temperature?: number;
  tool_choice?: string;
  tools?: ChatRequestTool[];
  top_p?: number;
}

/** Chat completion response */
export interface ChatResponse {
  readonly choices?: ChatChoice[];
  readonly created?: number;
  readonly id?: string;
  readonly model?: string;
  readonly object?: string;
  readonly usage?: ChatUsage;
}

/** Delta content in a streaming chat chunk */
export interface ChatStreamDelta {
  readonly content?: string | null;
  readonly function_call?: ChatFunctionCall;
  readonly role?: string;
  readonly tool_calls?: ChatToolCall[];
}

/** A choice in a streaming chat chunk */
export interface ChatStreamChoice {
  readonly delta?: ChatStreamDelta;
  readonly finish_reason?: string | null;
  readonly index?: number;
}

/** A streaming chat completion chunk */
export interface ChatStreamChunk {
  readonly choices?: ChatStreamChoice[];
  readonly created?: number;
  readonly id?: string;
  readonly model?: string;
  readonly object?: string;
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

/** Embeddings usage information */
export interface EmbeddingsUsageInfo {
  readonly prompt_tokens?: number;
  readonly total_tokens?: number;
}

/** Embeddings request body */
export interface EmbeddingsRequest {
  dimensions?: number;
  input: string | string[];
  model: string;
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

/** Guardrail configuration for a guard check */
export interface GuardrailConfig {
  action?: string;
  check?: string;
  custom_patterns?: string[];
  model?: string;
  presets?: string[];
  replacement?: string;
  type: string;
}

/** Guard result information */
export interface GuardInfo {
  readonly findings?: unknown[];
  readonly flagged: boolean;
  readonly type: string;
}

/** Hints for function execution */
export interface Hints {
  input_guardrails?: GuardrailConfig[];
  instructions?: string;
  max_tokens?: number;
  model?: string;
  output_guardrails?: GuardrailConfig[];
  prefer?: string;
  reasoning_effort?: string;
  stream?: boolean;
  temperature?: number;
}

/** Tool definition for function requests */
export interface Tool {
  description?: string;
  name: string;
  parameters: Record<string, unknown>;
}

/** Token usage information */
export interface UsageInfo {
  readonly cache_creation_tokens?: number;
  readonly cache_read_tokens?: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly reasoning_tokens?: number;
}

/** Response metadata from a function run */
export interface ResponseMeta {
  readonly execution_ms: number;
  readonly function_name: string;
  readonly generation_ms?: number;
  readonly guards?: GuardInfo[];
  readonly image_gen_calls: number;
  readonly llm_calls: number;
  readonly model_warnings?: string[];
  readonly models_used?: string[];
  readonly script_cached: boolean;
  readonly tts_calls: number;
  readonly usage?: UsageInfo;
}

/** Summary information about a function */
export interface FunctionInfo {
  readonly generated_at: string;
  readonly has_script: boolean;
  readonly hit_count: number;
  readonly name: string;
  readonly schema_hash: string;
}

/** Detailed information about a function */
export interface FunctionDetails {
  readonly generated_at: string;
  readonly hit_count: number;
  readonly input_schema: Record<string, unknown>;
  readonly name: string;
  readonly output_schema: Record<string, unknown>;
  readonly schema_hash: string;
  readonly source: string;
}

/** Function revision details */
export interface FunctionRevision {
  readonly created_at: string;
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
  readonly revision_id: number;
  readonly schema_hash: string;
  readonly source: string;
}

/** Revision summary information */
export interface RevisionInfo {
  readonly created_at: string;
  readonly is_current: boolean;
  readonly revision_id: number;
  readonly schema_hash: string;
}

/** Request body for updating a function */
export interface UpdateFunctionRequest {
  source: string;
}

/** Request body for running a function */
export interface RunRequest {
  hints?: Hints;
  input: Record<string, unknown>;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  parent_span_id?: string;
  tools?: Tool[];
}

/** Response from running a function */
export interface RunResponse {
  readonly meta?: ResponseMeta;
  readonly output: unknown;
}

/** Request body for creating a realtime function */
export interface RealtimeCreateRequest {
  instructions: string;
  model?: string;
  provider?: string;
  tools?: Tool[];
  voice?: string;
}

/** Response from creating a realtime function */
export interface RealtimeCreateResponse {
  readonly cached: boolean;
  readonly name: string;
  readonly reasoning?: string;
  readonly script: string;
}

// -----------------------------------------------------------------------------
// Parse types
// -----------------------------------------------------------------------------

/** Request body for parsing Starlark source */
export interface ParseRequest {
  source: string;
}

// -----------------------------------------------------------------------------
// Reasoning types
// -----------------------------------------------------------------------------

/** Reasoning configuration */
export interface ReasoningConfig {
  effort?: string;
}

// -----------------------------------------------------------------------------
// Generation config types
// -----------------------------------------------------------------------------

/** Generation configuration */
export interface GenerationConfig {
  max_output_tokens?: number;
  temperature?: number;
  thinking_level?: string;
  top_k?: number;
  top_p?: number;
}

// -----------------------------------------------------------------------------
// Interactions types
// -----------------------------------------------------------------------------

/** Error information in an interaction response */
export interface InteractionsError {
  readonly code: string;
  readonly message: string;
}

/** Function declaration for interactions */
export interface InteractionsFunction {
  description?: string;
  name: string;
  parameters?: Record<string, unknown>;
}

/** Tool definition for interactions */
export interface InteractionsTool {
  function_declarations?: InteractionsFunction[];
  type?: string;
}

/** Output item in an interaction response */
export interface InteractionsOutput {
  readonly args?: Record<string, unknown>;
  readonly data?: string;
  readonly id?: string;
  readonly mime_type?: string;
  readonly name?: string;
  readonly summary?: string;
  readonly text?: string;
  readonly thought?: string;
  readonly type: string;
}

/** Usage information for interactions */
export interface InteractionsUsage {
  readonly total_tokens: number;
}

/** Interactions request body */
export interface InteractionsRequest {
  agent?: string;
  background?: boolean;
  generation_config?: GenerationConfig;
  input: unknown;
  model?: string;
  previous_interaction_id?: string;
  response_format?: Record<string, unknown>;
  store?: boolean;
  stream?: boolean;
  system_instruction?: string;
  tools?: InteractionsTool[];
}

/** Interactions response */
export interface InteractionsResponse {
  readonly agent?: string;
  readonly error?: InteractionsError;
  readonly id: string;
  readonly input?: unknown;
  readonly model?: string;
  readonly outputs: InteractionsOutput[];
  readonly previous_interaction_id?: string;
  readonly status: string;
  readonly usage?: InteractionsUsage;
}

// -----------------------------------------------------------------------------
// Models types
// -----------------------------------------------------------------------------

/** Embedding parameters */
export interface ModelEmbeddingParams {
  readonly dimensions: number;
  readonly max_input_tokens?: number;
  readonly supports_dimensions?: boolean;
}

/** Image generation parameters */
export interface ModelImageParams {
  readonly default?: string;
  readonly qualities?: string[];
  readonly sizes?: string[];
  readonly styles?: string[];
}

/** Image edit parameters */
export interface ModelImageEditParams {
  readonly aspect_ratios?: string[];
  readonly default?: string;
}

/** Realtime parameters */
export interface ModelRealtimeParams {
  readonly default_voice?: string;
  readonly input_audio_format?: string;
  readonly output_audio_format?: string;
  readonly sample_rate?: number;
  readonly supports_tools?: boolean;
  readonly supports_vad?: boolean;
  readonly voices?: string[];
}

/** Reasoning parameters */
export interface ModelReasoningParams {
  readonly default: string;
  readonly supported: string[];
}

/** Speech-to-text parameters */
export interface ModelSttParams {
  readonly default_language?: string;
  readonly formats?: string[];
  readonly languages?: string[];
}

/** Temperature parameters */
export interface ModelTemperatureParams {
  readonly default: number;
  readonly max: number;
  readonly min: number;
}

/** Text-to-speech parameters */
export interface ModelTtsParams {
  readonly default_voice?: string;
  readonly max_length?: number;
  readonly voices?: string[];
}

/** Video generation parameters */
export interface ModelVideoParams {
  readonly aspect_ratios?: string[];
  readonly max_duration?: number;
  readonly max_fps?: number;
  readonly max_frames?: number;
  readonly resolutions?: string[];
  readonly speed_modes?: string[];
  readonly supports_seed?: boolean;
}

/** Model-specific parameters */
export interface ModelParams {
  readonly default_max_tokens: number;
  readonly embedding?: ModelEmbeddingParams;
  readonly image?: ModelImageParams;
  readonly image_edit?: ModelImageEditParams;
  readonly max_tokens: boolean;
  readonly realtime?: ModelRealtimeParams;
  readonly reasoning?: ModelReasoningParams;
  readonly stt?: ModelSttParams;
  readonly temperature?: ModelTemperatureParams;
  readonly tts?: ModelTtsParams;
  readonly video?: ModelVideoParams;
}

/** Information about a model */
export interface ModelInfo {
  readonly capabilities: string[];
  readonly context_window: number;
  readonly cost: string;
  readonly deprecated?: boolean;
  readonly description: string;
  readonly id: string;
  readonly model_id: string;
  readonly name: string;
  readonly params?: ModelParams;
  readonly provider: string;
  readonly quality: string;
  readonly speed: string;
  readonly successor?: string;
  readonly type: string;
}

/** Response containing a list of models */
export interface ModelsResponse {
  readonly models: ModelInfo[];
}

// -----------------------------------------------------------------------------
// Responses types
// -----------------------------------------------------------------------------

/** Error information in a responses response */
export interface ResponsesError {
  readonly code: string;
  readonly message: string;
}

/** Content item within a responses output item */
export interface ResponsesOutputContent {
  readonly annotations?: unknown[];
  readonly text?: string;
  readonly type: string;
}

/** Output item in a responses response */
export interface ResponsesOutputItem {
  readonly arguments?: string;
  readonly call_id?: string;
  readonly content?: ResponsesOutputContent[];
  readonly id?: string;
  readonly name?: string;
  readonly role?: string;
  readonly status?: string;
  readonly type: string;
}

/** Tool definition for responses */
export interface ResponsesTool {
  description?: string;
  headers?: Record<string, string>;
  name?: string;
  parameters?: Record<string, unknown>;
  require_approval?: string;
  server_label?: string;
  server_url?: string;
  type: string;
}

/** Output token usage details */
export interface ResponsesOutputTokensDetails {
  readonly reasoning_tokens?: number;
}

/** Usage information for responses */
export interface ResponsesUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly output_tokens_details?: ResponsesOutputTokensDetails;
  readonly total_tokens: number;
}

/** Responses request body */
export interface ResponsesRequest {
  input: unknown;
  instructions?: string;
  max_output_tokens?: number;
  metadata?: Record<string, unknown>;
  model?: string;
  previous_response_id?: string;
  reasoning?: ReasoningConfig;
  store?: boolean;
  stream?: boolean;
  temperature?: number;
  tool_choice?: unknown;
  tools?: ResponsesTool[];
  top_p?: number;
  user?: string;
}

/** Responses response */
export interface ResponsesResponse {
  readonly created_at: number;
  readonly error: ResponsesError | null;
  readonly id: string;
  readonly incomplete_details: unknown;
  readonly instructions?: string;
  readonly max_output_tokens?: number;
  readonly metadata?: Record<string, unknown>;
  readonly model: string;
  readonly object: string;
  readonly output: ResponsesOutputItem[];
  readonly output_text?: string;
  readonly previous_response_id?: string;
  readonly reasoning?: ReasoningConfig;
  readonly status: string;
  readonly temperature?: number;
  readonly tool_choice: unknown;
  readonly tools?: ResponsesTool[];
  readonly top_p?: number;
  readonly usage?: ResponsesUsage;
  readonly user?: string;
}

// -----------------------------------------------------------------------------
// Inline response types for endpoints with inline schemas
// -----------------------------------------------------------------------------

/** Response from listing functions */
export interface ListFunctionsResponse {
  readonly functions?: FunctionInfo[];
}

/** Response from listing revisions */
export interface ListRevisionsResponse {
  readonly revisions?: RevisionInfo[];
}

/** Pagination metadata for list responses */
export interface PaginationMeta {
  readonly page?: number;
  readonly page_size?: number;
  readonly total?: number;
  readonly total_pages?: number;
}

/** Response from listing generations */
export interface ListGenerationsResponse {
  readonly data?: Record<string, unknown>[];
  readonly meta?: PaginationMeta;
}

/** Response from deleting a generation */
export interface DeleteGenerationResponse {
  readonly deleted?: boolean;
}

/** Response from health check */
export interface HealthCheckResponse {
  readonly status?: string;
}

/** Parsed script response (generic object) */
export interface ParseResponse {
  readonly [key: string]: unknown;
}

/** Generation detail (generic recorded generation object) */
export interface GenerationDetail {
  readonly [key: string]: unknown;
}

