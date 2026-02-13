// =============================================================================
// Task API SDK – Main Entry Point
// =============================================================================

// Re-export ApiError class (runtime value)
export { ApiError } from './types.js';

// Re-export all type definitions
export type {
  ErrorDetail,
  ErrorResponse,
  ChatFunctionCall,
  ChatToolCall,
  ChatMessage,
  ChatChoice,
  ChatUsage,
  ChatRequestMessage,
  ChatRequestToolFunction,
  ChatRequestTool,
  StreamOptions,
  ChatRequest,
  ChatResponse,
  ChatStreamDelta,
  ChatStreamChoice,
  ChatStreamChunk,
  EmbeddingsDataItem,
  EmbeddingsUsageInfo,
  EmbeddingsRequest,
  EmbeddingsResponse,
  GuardrailConfig,
  GuardInfo,
  Hints,
  Tool,
  UsageInfo,
  ResponseMeta,
  FunctionInfo,
  FunctionDetails,
  FunctionRevision,
  RevisionInfo,
  UpdateFunctionRequest,
  RunRequest,
  RunResponse,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  ParseRequest,
  ReasoningConfig,
  GenerationConfig,
  InteractionsError,
  InteractionsFunction,
  InteractionsTool,
  InteractionsOutput,
  InteractionsUsage,
  InteractionsRequest,
  InteractionsResponse,
  ModelInfo,
  ModelsResponse,
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesTool,
  ResponsesUsage,
  ResponsesRequest,
  ResponsesResponse,
  ListFunctionsResponse,
  ListRevisionsResponse,
  PaginationMeta,
  ListGenerationsResponse,
  DeleteGenerationResponse,
  HealthCheckResponse,
  ParseResponse,
  GenerationDetail,
  ModelEmbeddingParams,
  ModelImageParams,
  ModelImageEditParams,
  ModelRealtimeParams,
  ModelReasoningParams,
  ModelSttParams,
  ModelTemperatureParams,
  ModelTtsParams,
  ModelVideoParams,
  ModelParams,
  ResponsesOutputTokensDetails,
} from './types.js';

// Re-export base client (runtime value) and its types
export { BaseClient } from './client-base.js';
export type { ClientConfig, RequestOptions, SSEEvent } from './client-base.js';

// Re-export all client classes
export { FunctionsClient } from './clients/functions.js';
export { ChatClient } from './clients/chat.js';
export { ResponsesClient } from './clients/responses.js';
export { InteractionsClient } from './clients/interactions.js';
export { ModelsClient } from './clients/models.js';
export { EmbeddingsClient } from './clients/embeddings.js';
export { GenerationsClient } from './clients/generations.js';
export type { ListGenerationsParams } from './clients/generations.js';
export { ParseClient } from './clients/parse.js';
export { SystemClient } from './clients/system.js';

