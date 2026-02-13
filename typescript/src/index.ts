// =============================================================================
// Task API SDK - Main Entry Point
// =============================================================================

// Base client and configuration
export { BaseClient, type ClientConfig, type RequestOptions } from './client-base.js';

// Tag-specific clients
export { FunctionsClient } from './clients/functions.js';
export { ChatClient } from './clients/chat.js';
export { ResponsesClient } from './clients/responses.js';
export { InteractionsClient } from './clients/interactions.js';
export { ModelsClient } from './clients/models.js';
export { EmbeddingsClient } from './clients/embeddings.js';
export { GenerationsClient, type ListGenerationsOptions } from './clients/generations.js';
export { ParseClient, type ParseStarlarkResponse } from './clients/parse.js';
export { SystemClient } from './clients/system.js';

// All types and interfaces
export {
  ApiError,
  type ErrorDetail,
  type ErrorResponse,
  type ChatChoice,
  type ChatFunctionCall,
  type ChatMessage,
  type ChatRequest,
  type ChatRequestMessage,
  type ChatRequestTool,
  type ChatRequestToolFunction,
  type ChatResponse,
  type ChatStreamChoice,
  type ChatStreamChunk,
  type ChatStreamDelta,
  type ChatToolCall,
  type ChatUsage,
  type StreamOptions,
  type EmbeddingsDataItem,
  type EmbeddingsRequest,
  type EmbeddingsResponse,
  type EmbeddingsUsageInfo,
  type FunctionDetails,
  type FunctionInfo,
  type FunctionRevision,
  type GenerationConfig,
  type GuardInfo,
  type GuardrailConfig,
  type Hints,
  type RealtimeCreateRequest,
  type RealtimeCreateResponse,
  type ReasoningConfig,
  type ResponseMeta,
  type RevisionInfo,
  type RunRequest,
  type RunResponse,
  type Tool,
  type UpdateFunctionRequest,
  type UsageInfo,
  type InteractionsError,
  type InteractionsFunction,
  type InteractionsOutput,
  type InteractionsRequest,
  type InteractionsResponse,
  type InteractionsTool,
  type InteractionsUsage,
  type MessagesMessage,
  type MessagesRequest,
  type MessagesResponse,
  type MessagesResponseBlock,
  type MessagesTool,
  type MessagesUsage,
  type ModelEmbeddingParams,
  type ModelImageParams,
  type ModelImageEditParams,
  type ModelRealtimeParams,
  type ModelReasoningParams,
  type ModelSttParams,
  type ModelTemperatureParams,
  type ModelTtsParams,
  type ModelVideoParams,
  type ModelParams,
  type ModelPricing,
  type ModelInfo,
  type ModelsResponse,
  type ParseRequest,
  type ResponsesError,
  type ResponsesOutputContent,
  type ResponsesOutputItem,
  type ResponsesRequest,
  type ResponsesResponse,
  type ResponsesTool,
  type ResponsesOutputTokensDetails,
  type ResponsesUsage,
  type ListFunctionsResponse,
  type ListRevisionsResponse,
  type GenerationsPaginationMeta,
  type ListGenerationsResponse,
  type DeleteGenerationResponse,
  type HealthCheckResponse,
} from './types.js';

