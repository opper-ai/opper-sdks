// =============================================================================
// Task API SDK - Interactions Client (Google-compatible)
// =============================================================================

import { BaseClient } from '../client-base.js';
import {
  InteractionsRequest,
  InteractionsResponse,
  RequestOptions,
} from '../types.js';

/**
 * Client for the Google-compatible Interactions API.
 * Provides methods for creating interactions with optional streaming support.
 */
export class InteractionsClient extends BaseClient {
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
    return this.post<InteractionsResponse>('/v1/interactions', body, options);
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
    yield* this.stream<InteractionsResponse>('/v1/interactions', streamBody, options);
  }
}

