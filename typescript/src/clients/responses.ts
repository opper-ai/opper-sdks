// =============================================================================
// Task API SDK - Responses Client (OpenAI Responses API compatible)
// =============================================================================

import { BaseClient } from '../client-base.js';
import type {
  RequestOptions,
  ResponsesRequest,
  ResponsesResponse,
} from '../types.js';

/**
 * Client for the OpenAI Responses API compatible endpoint.
 * Provides methods for creating responses with optional streaming support.
 */
export class ResponsesClient extends BaseClient {
  /**
   * Create a response.
   *
   * Sends the input through the Responses API and returns a complete response.
   *
   * @param body - The responses request body.
   * @param options - Optional request options.
   * @returns The responses API response.
   */
  async create(
    body: ResponsesRequest,
    options?: RequestOptions,
  ): Promise<ResponsesResponse> {
    return this.post<ResponsesResponse>('/v1/responses', body, options);
  }

  /**
   * Create a streaming response.
   *
   * Sends the input through the Responses API and returns an async generator
   * that yields server-sent event chunks. The `stream` field is automatically
   * set to `true` in the request body.
   *
   * @param body - The responses request body (stream will be set to true).
   * @param options - Optional request options.
   * @returns An async generator yielding streamed response chunks.
   */
  async *createStream(
    body: ResponsesRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ResponsesResponse, void, undefined> {
    const streamBody: ResponsesRequest = {
      ...body,
      stream: true,
    };
    yield* this.stream<ResponsesResponse>('/v1/responses', streamBody, options);
  }
}

