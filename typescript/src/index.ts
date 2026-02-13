// Main entry point - re-exports all clients and types

// Base client
export { BaseClient } from './client-base.js';
export type { ClientConfig, RequestOptions } from './client-base.js';

// Tag-specific clients
export { FunctionsClient } from './clients/functions.js';
export { ChatClient } from './clients/chat.js';
export { ResponsesClient } from './clients/responses.js';
export { InteractionsClient } from './clients/interactions.js';
export { ModelsClient } from './clients/models.js';
export { EmbeddingsClient } from './clients/embeddings.js';
export { GenerationsClient } from './clients/generations.js';
export { ParseClient } from './clients/parse.js';
export { SystemClient } from './clients/system.js';

// All types
export type {
  ApiError,
  ChatChoice,
  ChatFunctionCall,
  ChatMessage,
  ChatRequest,
  ChatRequestMessage,
  ChatRequestTool,
  ChatRequestToolFunction,
  ChatResponse,
  ChatStreamChoice,
  ChatStreamChunk,
  ChatStreamDelta,
  ChatToolCall,
  ChatUsage,
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsUsageInfo,
  ErrorDetail,
  ErrorResponse,
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  GenerationConfig,
  GuardInfo,
  GuardrailConfig,
  Hints,
  InteractionsError,
  InteractionsFunction,
  InteractionsOutput,
  InteractionsRequest,
  InteractionsResponse,
  InteractionsTool,
  InteractionsUsage,
  MessagesMessage,
  MessagesRequest,
  MessagesResponse,
  MessagesResponseBlock,
  MessagesTool,
  MessagesUsage,
  ModelInfo,
  ModelsResponse,
  ParseRequest,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  ReasoningConfig,
  ResponseMeta,
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesRequest,
  ResponsesResponse,
  ResponsesTool,
  ResponsesUsage,
  RevisionInfo,
  RunRequest,
  RunResponse,
  StreamOptions,
  Tool,
  UpdateFunctionRequest,
  UsageInfo,
} from './types.js';

