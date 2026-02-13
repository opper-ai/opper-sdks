// =============================================================================
// Responses Client for Task API SDK
// =============================================================================

import { BaseClient, type RequestOptions, type SSEEvent } from '../client-base.js';
import type { ResponsesRequest, ResponsesResponse } from '../types.js';

/**
 * Client for the Responses API endpoints.
 *
 * Provides an OpenAI Responses API compatible endpoint with optional
 * streaming support via Server-Sent Events.
 */
export class ResponsesClient extends BaseClient {
  /**
   * Create a response (non-streaming).
   *
   * Sends a request to the Responses API and returns the complete response.
   * The `stream` field in the body should be `false` or omitted for non-streaming.
   *
   * @param body - The responses request body
   * @param options - Optional request options (headers, signal, etc.)
   * @returns The complete responses response
   */
  async createResponse(
    body: ResponsesRequest,
    options?: RequestOptions,
  ): Promise<ResponsesResponse> {
    return this.post<ResponsesResponse>('/v3/responses', { ...body, stream: false }, options);
  }

  /**
   * Create a response with streaming enabled.
   *
   * Sends a request to the Responses API with `stream: true` and returns
   * an async iterable of Server-Sent Events. Each event's `data` field
   * contains a JSON string that can be parsed. The stream terminates
   * with a `[DONE]` sentinel.
   *
   * @param body - The responses request body (stream will be set to true)
   * @param options - Optional request options (headers, signal, etc.)
   * @returns An async generator yielding SSE events
   */
  async *createResponseStream(
    body: Omit<ResponsesRequest, 'stream'>,
    options?: RequestOptions,
  ): AsyncGenerator<SSEEvent, void, undefined> {
    yield* this.stream('POST', '/v3/responses', { ...body, stream: true }, options);
  }
}

