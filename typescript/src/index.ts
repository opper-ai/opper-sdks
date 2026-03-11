// =============================================================================
// Opper SDK - Main Entry Point
// =============================================================================

import { ChatClient } from "./clients/chat.js";
import { EmbeddingsClient } from "./clients/embeddings.js";
import { FunctionsClient } from "./clients/functions.js";
import { GenerationsClient } from "./clients/generations.js";
import { InteractionsClient } from "./clients/interactions.js";
import { MessagesClient } from "./clients/messages.js";
import { ModelsClient } from "./clients/models.js";
import { ParseClient } from "./clients/parse.js";
import { ResponsesClient } from "./clients/responses.js";
import { SpansClient } from "./clients/spans.js";
import { SystemClient } from "./clients/system.js";
import type {
  ClientConfig,
  RequestOptions,
  RunRequest,
  RunResponse,
  StreamChunk,
} from "./types.js";

// ---------------------------------------------------------------------------
// Compat namespace
// ---------------------------------------------------------------------------

/** Compatibility endpoint clients grouped under a single namespace. */
export interface CompatClients {
  /** OpenAI-compatible chat completions. */
  readonly chat: ChatClient;
  /** OpenAI Responses API. */
  readonly responses: ResponsesClient;
  /** Google-compatible interactions. */
  readonly interactions: InteractionsClient;
  /** Anthropic-compatible messages. */
  readonly messages: MessagesClient;
  /** OpenAI-compatible embeddings. */
  readonly embeddings: EmbeddingsClient;
}

// ---------------------------------------------------------------------------
// Resolve config from env vars
// ---------------------------------------------------------------------------

function resolveConfig(config?: ClientConfig): Required<
  Pick<ClientConfig, "apiKey" | "baseUrl">
> & {
  headers?: Record<string, string>;
} {
  const apiKey =
    config?.apiKey || (typeof process !== "undefined" ? process.env.OPPER_API_KEY : undefined);
  if (!apiKey) {
    throw new Error(
      "Missing API key. Pass apiKey in the config or set the OPPER_API_KEY environment variable.",
    );
  }

  const baseUrl =
    config?.baseUrl ||
    (typeof process !== "undefined" ? process.env.OPPER_BASE_URL : undefined) ||
    "https://api.opper.ai";

  return { apiKey, baseUrl, headers: config?.headers };
}

// ---------------------------------------------------------------------------
// Opper Client
// ---------------------------------------------------------------------------

/**
 * Unified client for the Opper API.
 *
 * @example
 * ```typescript
 * import { Opper } from '@opperai/sdk';
 *
 * // Uses OPPER_API_KEY env var
 * const client = new Opper();
 *
 * // Or pass config explicitly
 * const client = new Opper({ apiKey: 'op-...' });
 *
 * const result = await client.run('my-fn', {
 *   input_schema: { type: 'object', properties: { q: { type: 'string' } } },
 *   output_schema: { type: 'object', properties: { a: { type: 'string' } } },
 *   input: { q: 'Hello' },
 * });
 * ```
 */
export class Opper {
  /** Client for function management and execution. */
  readonly functions: FunctionsClient;

  /** Client for trace spans. */
  readonly spans: SpansClient;

  /** Client for recorded generations. */
  readonly generations: GenerationsClient;

  /** Client for listing available models. */
  readonly models: ModelsClient;

  /** Client for Starlark script parsing. */
  readonly parse: ParseClient;

  /** Client for system health checks. */
  readonly system: SystemClient;

  /** Compatibility endpoint clients (OpenAI, Anthropic, Google). */
  readonly compat: CompatClients;

  constructor(config?: ClientConfig) {
    const resolved = resolveConfig(config);

    this.functions = new FunctionsClient(resolved);
    this.spans = new SpansClient(resolved);
    this.generations = new GenerationsClient(resolved);
    this.models = new ModelsClient(resolved);
    this.parse = new ParseClient(resolved);
    this.system = new SystemClient(resolved);

    this.compat = {
      chat: new ChatClient(resolved),
      responses: new ResponsesClient(resolved),
      interactions: new InteractionsClient(resolved),
      messages: new MessagesClient(resolved),
      embeddings: new EmbeddingsClient(resolved),
    };
  }

  /**
   * Convenience: execute a function by name.
   * Equivalent to `client.functions.runFunction(name, request)`.
   */
  async run(name: string, request: RunRequest, options?: RequestOptions): Promise<RunResponse> {
    return this.functions.runFunction(name, request, options);
  }

  /**
   * Convenience: stream a function execution by name.
   * Equivalent to `client.functions.streamFunction(name, request)`.
   */
  async *stream(
    name: string,
    request: RunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<StreamChunk, void, undefined> {
    yield* this.functions.streamFunction(name, request, options);
  }
}

// ---------------------------------------------------------------------------
// Re-exports: Sub-clients
// ---------------------------------------------------------------------------

export { BaseClient } from "./client-base.js";
export { ChatClient } from "./clients/chat.js";
export { EmbeddingsClient } from "./clients/embeddings.js";
export { FunctionsClient } from "./clients/functions.js";
export { GenerationsClient } from "./clients/generations.js";
export { InteractionsClient } from "./clients/interactions.js";
export { MessagesClient } from "./clients/messages.js";
export { ModelsClient } from "./clients/models.js";
export { ParseClient } from "./clients/parse.js";
export { ResponsesClient } from "./clients/responses.js";
export { SpansClient } from "./clients/spans.js";
export { SystemClient } from "./clients/system.js";

// ---------------------------------------------------------------------------
// Re-exports: Sub-client specific types
// ---------------------------------------------------------------------------

export type {
  CreateRealtimeFunctionRequest,
  Example,
  ListExamplesParams,
  ListExamplesResponse,
  ListFunctionsResponse,
  ListRevisionsResponse,
} from "./clients/functions.js";

export type {
  DeleteGenerationResponse,
  GenerationsListMeta,
  GenerationsListResponse,
  ListGenerationsParams as GenerationsListParams,
} from "./clients/generations.js";

export type { HealthCheckResponse } from "./clients/system.js";

// ---------------------------------------------------------------------------
// Re-exports: All types
// ---------------------------------------------------------------------------

export type {
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
  ChatStreamFunction,
  ChatStreamToolCall,
  ChatToolCall,
  ChatUsage,
  ClientConfig,
  CreateSpanRequest,
  CreateSpanResponse,
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
  InteractionsContent,
  InteractionsContentPart,
  InteractionsError,
  InteractionsFunction,
  InteractionsInlineData,
  InteractionsOutput,
  InteractionsRequest,
  InteractionsResponse,
  InteractionsTool,
  InteractionsUsage,
  ListGenerationsParams,
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
  RequestOptions,
  ResponseMeta,
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesOutputTokensDetails,
  ResponsesRequest,
  ResponsesResponse,
  ResponsesTool,
  ResponsesUsage,
  RevisionInfo,
  RunRequest,
  RunResponse,
  StreamChunk,
  StreamOptions,
  Tool,
  UpdateFunctionRequest,
  UpdateSpanRequest,
  UsageInfo,
} from "./types.js";

export { ApiError } from "./types.js";
