// =============================================================================
// Task API SDK - Main Entry Point
// =============================================================================

// Re-export all types
export {
  ApiError,
  ErrorDetail,
  ErrorResponse,
  ChatFunctionCall,
  ChatToolCall,
  ChatMessage,
  ChatRequestMessage,
  ChatRequestToolFunction,
  ChatRequestTool,
  StreamOptions,
  ChatRequest,
  ChatUsage,
  ChatChoice,
  ChatResponse,
  ChatStreamDelta,
  ChatStreamChoice,
  ChatStreamChunk,
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsUsageInfo,
  EmbeddingsResponse,
  GuardInfo,
  GuardrailConfig,
  Hints,
  Tool,
  UsageInfo,
  ResponseMeta,
  RunRequest,
  RunResponse,
  ReasoningConfig,
  FunctionInfo,
  FunctionDetails,
  FunctionRevision,
  RevisionInfo,
  UpdateFunctionRequest,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  InteractionsError,
  InteractionsFunction,
  InteractionsOutput,
  InteractionsTool,
  InteractionsUsage,
  InteractionsRequest,
  InteractionsResponse,
  MessagesMessage,
  MessagesTool,
  MessagesUsage,
  MessagesRequest,
  MessagesResponseBlock,
  MessagesResponse,
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesTool,
  ResponsesUsage,
  ResponsesRequest,
  ResponsesResponse,
  ModelInfo,
  ModelsResponse,
  ParseRequest,
  GenerationConfig,
  ListFunctionsResponse,
  ListRevisionsResponse,
  ListGenerationsResponse,
  DeleteGenerationResponse,
  GenerationsPaginationMeta,
  HealthCheckResponse,
} from './types.js';

export type {
  GetFunctionResponse,
  RunFunctionRequest,
  RunFunctionResponse,
  UpdateFunctionResponse,
  GetRevisionResponse,
  RevertRevisionResponse,
  GetGenerationResponse,
  ParseStarlarkResponse,
} from './types.js';

// Re-export base client and config
export { BaseClient } from './client-base.js';
export type { ClientConfig, RequestOptions } from './client-base.js';

// Re-export all client classes
export { FunctionsClient } from './clients/functions.js';
export { ChatClient } from './clients/chat.js';
export { ResponsesClient } from './clients/responses.js';
export { InteractionsClient } from './clients/interactions.js';
export { ModelsClient } from './clients/models.js';
export { EmbeddingsClient } from './clients/embeddings.js';
export { GenerationsClient } from './clients/generations.js';
export { ParseClient } from './clients/parse.js';
export { SystemClient } from './clients/system.js';

// Import client classes and config for the composed client
import type { ClientConfig } from './client-base.js';
import { FunctionsClient } from './clients/functions.js';
import { ChatClient } from './clients/chat.js';
import { ResponsesClient } from './clients/responses.js';
import { InteractionsClient } from './clients/interactions.js';
import { ModelsClient } from './clients/models.js';
import { EmbeddingsClient } from './clients/embeddings.js';
import { GenerationsClient } from './clients/generations.js';
import { ParseClient } from './clients/parse.js';
import { SystemClient } from './clients/system.js';

/**
 * Main Task API client that composes all sub-clients.
 *
 * Provides convenient access to all API endpoints through
 * organized sub-client instances.
 *
 * @example
 * ```typescript
 * const client = new TaskApiClient({ apiKey: 'your-api-key' });
 *
 * // Use sub-clients
 * const models = await client.models.listModels();
 * const functions = await client.functions.listFunctions();
 * const health = await client.system.healthCheck();
 * ```
 */
export class TaskApiClient {
  /** Client for managing schema-driven functions */
  readonly functions: FunctionsClient;

  /** Client for OpenAI-compatible chat completions */
  readonly chat: ChatClient;

  /** Client for OpenAI Responses API compatible endpoints */
  readonly responses: ResponsesClient;

  /** Client for Google-compatible interactions endpoints */
  readonly interactions: InteractionsClient;

  /** Client for listing available models */
  readonly models: ModelsClient;

  /** Client for OpenAI-compatible embeddings */
  readonly embeddings: EmbeddingsClient;

  /** Client for managing recorded generations */
  readonly generations: GenerationsClient;

  /** Client for parsing Starlark scripts */
  readonly parse: ParseClient;

  /** Client for system health checks */
  readonly system: SystemClient;

  /**
   * Create a new TaskApiClient instance.
   *
   * @param config - Client configuration including API key and optional base URL
   */
  constructor(config: ClientConfig) {
    this.functions = new FunctionsClient(config);
    this.chat = new ChatClient(config);
    this.responses = new ResponsesClient(config);
    this.interactions = new InteractionsClient(config);
    this.models = new ModelsClient(config);
    this.embeddings = new EmbeddingsClient(config);
    this.generations = new GenerationsClient(config);
    this.parse = new ParseClient(config);
    this.system = new SystemClient(config);
  }
}

