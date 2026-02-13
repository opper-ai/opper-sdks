import { BaseClient } from '../client-base.js';
import type { RequestOptions } from '../client-base.js';
import type {
  ResponsesRequest,
  ResponsesResponse,
  MessagesRequest,
  MessagesResponse,
} from '../types.js';

/**
 * Client for OpenAI Responses API compatible endpoints.
 * Also handles Messages-related operations which are part of the Responses API.
 */
export class ResponsesClient extends BaseClient {
  /**
   * Create a response using the Responses API.
   *
   * @param request - The response creation request
   * @param options - Optional request options
   * @returns The created response
   */
  async create(
    request: ResponsesRequest,
    options?: RequestOptions,
  ): Promise<ResponsesResponse> {
    return this.post<ResponsesResponse>(
      '/v1/responses',
      { ...request, stream: false },
      options,
    );
  }

  /**
   * Create a response with streaming enabled.
   *
   * Sends a request to the Responses API and returns an async generator
   * that yields parsed response objects as they arrive via Server-Sent Events.
   *
   * The `stream` field on the request is automatically set to `true`.
   *
   * @param request - The response creation request
   * @param options - Optional request options
   * @returns An async generator yielding streamed response chunks
   *
   * @example
   * ```ts
   * const client = new ResponsesClient({ apiKey: 'my-key' });
   * for await (const chunk of client.createStream({ model: 'gpt-4', input: 'Hello' })) {
   *   console.log(chunk);
   * }
   * ```
   */
  async *createStream(
    request: ResponsesRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ResponsesResponse, void, undefined> {
    yield* this.streamJson<ResponsesResponse>(
      '/v1/responses',
      { ...request, stream: true },
      options,
    );
  }

  /**
   * Create a message using the Messages API.
   *
   * @param request - The message creation request
   * @param options - Optional request options
   * @returns The created message response
   */
  async createMessage(
    request: MessagesRequest,
    options?: RequestOptions,
  ): Promise<MessagesResponse> {
    return this.post<MessagesResponse>(
      '/v1/messages',
      { ...request, stream: false },
      options,
    );
  }

  /**
   * Create a message with streaming enabled.
   *
   * Sends a request to the Messages API and returns an async generator
   * that yields parsed message response objects as they arrive via
   * Server-Sent Events.
   *
   * The `stream` field on the request is automatically set to `true`.
   *
   * @param request - The message creation request
   * @param options - Optional request options
   * @returns An async generator yielding streamed message response chunks
   *
   * @example
   * ```ts
   * const client = new ResponsesClient({ apiKey: 'my-key' });
   * for await (const chunk of client.createMessageStream({ model: 'claude-3', messages: [{ role: 'user', content: 'Hello' }] })) {
   *   console.log(chunk);
   * }
   * ```
   */
  async *createMessageStream(
    request: MessagesRequest,
    options?: RequestOptions,
  ): AsyncGenerator<MessagesResponse, void, undefined> {
    yield* this.streamJson<MessagesResponse>(
      '/v1/messages',
      { ...request, stream: true },
      options,
    );
  }
}

