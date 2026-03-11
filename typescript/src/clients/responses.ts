// =============================================================================
// Task API SDK - Responses Client (OpenAI Responses API compatible)
// =============================================================================

import { BaseClient } from "../client-base.js";
import type { RequestOptions, ResponsesRequest, ResponsesResponse } from "../types.js";

/** Base path for the Responses API endpoints. */
const RESPONSES_PATH = "/v3/compat/responses";

/**
 * Client for the OpenAI Responses API compatible endpoints.
 *
 * Provides methods for creating responses with optional streaming support.
 * This client is compatible with the OpenAI Responses API format.
 */
export class ResponsesClient extends BaseClient {
  /**
   * Create a response.
   *
   * Sends the input through the Responses API and returns a complete response.
   * For streaming responses, use {@link createStream}.
   *
   * @param body - The responses request body.
   * @param options - Optional request options (headers, signal).
   * @returns The responses API response.
   */
  async create(body: ResponsesRequest, options?: RequestOptions): Promise<ResponsesResponse> {
    // Ensure stream is not set or is false for non-streaming requests
    const requestBody: ResponsesRequest = { ...body, stream: false };
    return this.post<ResponsesResponse>(RESPONSES_PATH, requestBody, options);
  }

  /**
   * Create a streaming response.
   *
   * Sends the input through the Responses API and returns an async generator
   * that yields server-sent event chunks. The `stream` field is automatically
   * set to `true` in the request body.
   *
   * @param body - The responses request body. The `stream` field will be
   *   automatically set to `true`.
   * @param options - Optional request options (headers, signal).
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
    yield* this.stream<ResponsesResponse>(RESPONSES_PATH, streamBody, options);
  }
}
