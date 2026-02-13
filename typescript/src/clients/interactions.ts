// =============================================================================
// Task API SDK - Interactions Client (Google-compatible + Anthropic Messages)
// =============================================================================

import { BaseClient } from '../client-base.js';
import type {
  InteractionsRequest,
  InteractionsResponse,
  MessagesRequest,
  MessagesResponse,
  RequestOptions,
} from '../types.js';

/** Path for the Google-compatible interactions endpoint. */
const INTERACTIONS_PATH = '/v1/interactions';

/** Path for the Anthropic-compatible messages endpoint. */
const MESSAGES_PATH = '/v1/messages';

/**
 * Client for the Google-compatible Interactions API and Anthropic-compatible
 * Messages API.
 *
 * Provides methods for creating interactions and messages with optional
 * streaming support.
 */
export class InteractionsClient extends BaseClient {
  // ---------------------------------------------------------------------------
  // Interactions (Google-compatible)
  // ---------------------------------------------------------------------------

  /**
   * Create an interaction.
   *
   * Sends an interaction request and returns the complete response.
   * For streaming responses, use {@link createStream} instead.
   *
   * @param body - The interaction request body.
   * @param options - Optional request options (headers, signal).
   * @returns The interaction response.
   */
  async create(
    body: InteractionsRequest,
    options?: RequestOptions,
  ): Promise<InteractionsResponse> {
    return this.post<InteractionsResponse>(INTERACTIONS_PATH, body, options);
  }

  /**
   * Create an interaction with streaming.
   *
   * Sends an interaction request with `stream: true` and returns an async
   * generator that yields partial interaction response chunks as they arrive
   * via Server-Sent Events.
   *
   * @param body - The interaction request body. The `stream` field will be set to `true`.
   * @param options - Optional request options (headers, signal).
   * @returns An async generator yielding interaction response chunks.
   */
  async *createStream(
    body: InteractionsRequest,
    options?: RequestOptions,
  ): AsyncGenerator<InteractionsResponse, void, undefined> {
    const streamBody: InteractionsRequest = { ...body, stream: true };
    yield* this.stream<InteractionsResponse>(INTERACTIONS_PATH, streamBody, options);
  }

  // ---------------------------------------------------------------------------
  // Messages (Anthropic-compatible)
  // ---------------------------------------------------------------------------

  /**
   * Create a message.
   *
   * Sends an Anthropic-compatible messages request and returns the complete
   * response. For streaming responses, use {@link createMessageStream} instead.
   *
   * @param body - The messages request body.
   * @param options - Optional request options (headers, signal).
   * @returns The messages response.
   */
  async createMessage(
    body: MessagesRequest,
    options?: RequestOptions,
  ): Promise<MessagesResponse> {
    const requestBody: MessagesRequest = { ...body, stream: false };
    return this.post<MessagesResponse>(MESSAGES_PATH, requestBody, options);
  }

  /**
   * Create a message with streaming.
   *
   * Sends an Anthropic-compatible messages request with `stream: true` and
   * returns an async generator that yields partial message response chunks
   * as they arrive via Server-Sent Events.
   *
   * @param body - The messages request body. The `stream` field will be set to `true`.
   * @param options - Optional request options (headers, signal).
   * @returns An async generator yielding messages response chunks.
   */
  async *createMessageStream(
    body: MessagesRequest,
    options?: RequestOptions,
  ): AsyncGenerator<MessagesResponse, void, undefined> {
    const streamBody: MessagesRequest = { ...body, stream: true };
    yield* this.stream<MessagesResponse>(MESSAGES_PATH, streamBody, options);
  }
}

