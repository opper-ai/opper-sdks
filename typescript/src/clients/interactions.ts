// =============================================================================
// Interactions Client for Task API SDK
// =============================================================================

import { BaseClient, ClientConfig, RequestOptions, SSEEvent } from '../client-base.js';
import { InteractionsRequest, InteractionsResponse } from '../types.js';

/**
 * Client for the Interactions API endpoints.
 * Provides Google-compatible interactions with support for streaming.
 */
export class InteractionsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * Create an interaction.
   *
   * Sends an interaction request and returns the full response.
   * For streaming responses, use {@link createInteractionStream} instead.
   *
   * @param body - The interaction request body
   * @param options - Additional request options
   * @returns The interaction response
   */
  async createInteraction(
    body: InteractionsRequest,
    options?: RequestOptions,
  ): Promise<InteractionsResponse> {
    return this.post<InteractionsResponse>('/v3/interactions', body, options);
  }

  /**
   * Create a streaming interaction.
   *
   * Sends an interaction request with streaming enabled and returns an async
   * iterable of Server-Sent Events. The `stream` property on the request body
   * will be set to `true` automatically.
   *
   * Each yielded {@link SSEEvent} contains a `data` field. Use
   * `parseSSEData<InteractionsResponse>()` to parse individual events.
   * The stream terminates with a `[DONE]` sentinel.
   *
   * @param body - The interaction request body (stream will be set to true)
   * @param options - Additional request options
   * @returns An async generator of SSE events
   */
  async *createInteractionStream(
    body: InteractionsRequest,
    options?: RequestOptions,
  ): AsyncGenerator<SSEEvent, void, undefined> {
    const streamBody: InteractionsRequest = { ...body, stream: true };
    yield* this.stream('POST', '/v3/interactions', streamBody, options);
  }
}

