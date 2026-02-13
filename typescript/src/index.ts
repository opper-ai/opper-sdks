// =============================================================================
// Task API SDK - Unified Client & Re-exports
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

// -----------------------------------------------------------------------------
// Unified Client
// -----------------------------------------------------------------------------

/**
 * Unified Task API client.
 *
 * Takes a {@link ClientConfig} in the constructor and exposes each API
 * domain as a sub-client property.
 *
 * @example
 * ```ts
 * const client = new TaskApiClient({ apiKey: 'my-key' });
 * const models = await client.models.listModels();
 * ```
 */
export class TaskApiClient {
  /** Functions management client. */
  readonly functions: FunctionsClient;
  /** OpenAI-compatible chat completions client. */
  readonly chat: ChatClient;
  /** OpenAI Responses API compatible client. */
  readonly responses: ResponsesClient;
  /** Google-compatible interactions client. */
  readonly interactions: InteractionsClient;
  /** Model registry client. */
  readonly models: ModelsClient;
  /** OpenAI-compatible embeddings client. */
  readonly embeddings: EmbeddingsClient;
  /** Recorded generations management client. */
  readonly generations: GenerationsClient;
  /** Starlark parse client. */
  readonly parse: ParseClient;
  /** System health and readiness client. */
  readonly system: SystemClient;

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

// -----------------------------------------------------------------------------
// Re-export types
// -----------------------------------------------------------------------------

export {
  ApiError,
  type ClientConfig,
  type RequestOptions,
  type ErrorDetail,
  type ErrorResponse,
  type ChatFunctionCall,
  type ChatToolCall,
  type ChatMessage,
  type ChatChoice,
  type ChatUsage,
  type ChatResponse,
  type StreamOptions,
  type ChatRequestToolFunction,
  type ChatRequestTool,
  type ChatRequestMessage,
  type ChatRequest,
  type ChatStreamDelta,
  type ChatStreamToolCall,
  type ChatStreamToolCallFunction,
  type ChatStreamChoice,
  type ChatStreamChunk,
  type EmbeddingsDataItem,
  type EmbeddingsUsageInfo,
  type EmbeddingsRequest,
  type EmbeddingsResponse,
  type GuardrailConfig,
  type GuardInfo,
  type Hints,
  type FunctionDetails,
  type FunctionInfo,
  type FunctionRevision,
  type RevisionInfo,
  type Tool,
  type UsageInfo,
  type ResponseMeta,
  type RunRequest,
  type RunResponse,
  type UpdateFunctionRequest,
  type RealtimeCreateRequest,
  type RealtimeCreateTool,
  type RealtimeCreateResponse,
  type GenerationConfig,
  type InteractionsError,
  type InteractionsFunction,
  type InteractionsOutput,
  type InteractionsTool,
  type InteractionsUsage,
  type InteractionsRequest,
  type InteractionsResponse,
  type MessagesMessage,
  type MessagesTool,
  type MessagesRequest,
  type MessagesResponseBlock,
  type MessagesUsage,
  type MessagesResponse,
  type ModelTemperatureParams,
  type ModelReasoningParams,
  type ModelEmbeddingParams,
  type ModelImageParams,
  type ModelImageEditParams,
  type ModelRealtimeParams,
  type ModelTtsParams,
  type ModelSttParams,
  type ModelVideoParams,
  type ModelParams,
  type ModelPricing,
  type ModelInfo,
  type ModelsResponse,
  type ParseRequest,
  type ReasoningConfig,
  type ResponsesError,
  type ResponsesOutputContent,
  type ResponsesOutputItem,
  type ResponsesTool,
  type ResponsesOutputTokensDetails,
  type ResponsesUsage,
  type ResponsesRequest,
  type ResponsesResponse,
} from './types.js';

// -----------------------------------------------------------------------------
// Re-export base client
// -----------------------------------------------------------------------------

export { BaseClient } from './client-base.js';

// -----------------------------------------------------------------------------
// Re-export sub-clients
// -----------------------------------------------------------------------------

export { FunctionsClient } from './clients/functions.js';
export type { ListFunctionsResponse, ListRevisionsResponse } from './clients/functions.js';

export { ChatClient } from './clients/chat.js';

export { ResponsesClient } from './clients/responses.js';

export { InteractionsClient } from './clients/interactions.js';

export { ModelsClient } from './clients/models.js';

export { EmbeddingsClient } from './clients/embeddings.js';

export { GenerationsClient } from './clients/generations.js';
export type {
  GenerationsListMeta,
  GenerationsListResponse,
  GenerationDeleteResponse,
} from './clients/generations.js';

export { ParseClient } from './clients/parse.js';

export { SystemClient } from './clients/system.js';
export type { HealthCheckResponse } from './clients/system.js';

