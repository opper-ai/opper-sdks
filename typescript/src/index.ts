// =============================================================================
// Task API TypeScript SDK - Main Entry Point
// =============================================================================

import type { ClientConfig } from './types.js';
import { FunctionsClient } from './clients/functions.js';
import { ChatClient } from './clients/chat.js';
import { ResponsesClient } from './clients/responses.js';
import { InteractionsClient } from './clients/interactions.js';
import { ModelsClient } from './clients/models.js';
import { EmbeddingsClient } from './clients/embeddings.js';
import { GenerationsClient } from './clients/generations.js';
import { ParseClient } from './clients/parse.js';
import { SystemClient } from './clients/system.js';

// ---------------------------------------------------------------------------
// Unified Client
// ---------------------------------------------------------------------------

/**
 * Unified client for the Task API v3.0.0.
 *
 * Takes a {@link ClientConfig} in the constructor and exposes all API
 * sub-clients as readonly properties.
 *
 * @example
 * ```typescript
 * import { TaskApiClient } from 'task-api-sdk';
 *
 * const client = new TaskApiClient({ apiKey: 'your-api-key' });
 *
 * // Use sub-clients
 * const models = await client.models.listModels();
 * const result = await client.functions.runFunction('myFunc', { ... });
 * ```
 */
export class TaskApiClient {
  /** Client for Function management and execution endpoints. */
  readonly functions: FunctionsClient;

  /** Client for OpenAI-compatible chat completion endpoints. */
  readonly chat: ChatClient;

  /** Client for OpenAI Responses API compatible endpoints. */
  readonly responses: ResponsesClient;

  /** Client for Google-compatible interactions endpoints. */
  readonly interactions: InteractionsClient;

  /** Client for listing available models. */
  readonly models: ModelsClient;

  /** Client for OpenAI-compatible embeddings endpoint. */
  readonly embeddings: EmbeddingsClient;

  /** Client for recorded generation management endpoints. */
  readonly generations: GenerationsClient;

  /** Client for Starlark script parsing endpoint. */
  readonly parse: ParseClient;

  /** Client for system health and status endpoints. */
  readonly system: SystemClient;

  /**
   * Create a new TaskApiClient.
   *
   * @param config - SDK configuration including API key, optional base URL,
   *   and optional custom headers.
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

// ---------------------------------------------------------------------------
// Re-exports: Sub-clients
// ---------------------------------------------------------------------------

export { FunctionsClient } from './clients/functions.js';
export { ChatClient } from './clients/chat.js';
export { ResponsesClient } from './clients/responses.js';
export { InteractionsClient } from './clients/interactions.js';
export { ModelsClient } from './clients/models.js';
export { EmbeddingsClient } from './clients/embeddings.js';
export { GenerationsClient } from './clients/generations.js';
export { ParseClient } from './clients/parse.js';
export { SystemClient } from './clients/system.js';

// ---------------------------------------------------------------------------
// Re-exports: Sub-client specific types
// ---------------------------------------------------------------------------

export type {
  CreateRealtimeFunctionRequest,
  ListFunctionsResponse,
  ListRevisionsResponse,
} from './clients/functions.js';

export type {
  GenerationsListMeta,
  GenerationsListResponse,
  ListGenerationsParams as GenerationsListParams,
  DeleteGenerationResponse,
} from './clients/generations.js';

export type { HealthCheckResponse } from './clients/system.js';

// ---------------------------------------------------------------------------
// Re-exports: Base client
// ---------------------------------------------------------------------------

export { BaseClient } from './client-base.js';

// ---------------------------------------------------------------------------
// Re-exports: All types
// ---------------------------------------------------------------------------

export type {
  ClientConfig,
  RequestOptions,
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
  ChatStreamToolCall,
  ChatStreamFunction,
  ChatStreamChoice,
  ChatStreamChunk,
  EmbeddingsDataItem,
  EmbeddingsUsageInfo,
  EmbeddingsRequest,
  EmbeddingsResponse,
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  GenerationConfig,
  GuardInfo,
  GuardrailConfig,
  Hints,
  Tool,
  UsageInfo,
  ResponseMeta,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
  RevisionInfo,
  ReasoningConfig,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  CreateSpanRequest,
  CreateSpanResponse,
  UpdateSpanRequest,
  InteractionsFunction,
  InteractionsTool,
  InteractionsContentPart,
  InteractionsInlineData,
  InteractionsContent,
  InteractionsRequest,
  InteractionsOutput,
  InteractionsUsage,
  InteractionsError,
  InteractionsResponse,
  MessagesMessage,
  MessagesTool,
  MessagesRequest,
  MessagesResponseBlock,
  MessagesUsage,
  MessagesResponse,
  ModelInfo,
  ModelsResponse,
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesTool,
  ResponsesOutputTokensDetails,
  ResponsesUsage,
  ResponsesRequest,
  ResponsesResponse,
  ParseRequest,
  ListGenerationsParams,
} from './types.js';

export { ApiError } from './types.js';

