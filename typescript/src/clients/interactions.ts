import { BaseClient } from '../client-base.js';
import type {
  InteractionsRequest,
  InteractionsResponse,
  MessagesRequest,
  MessagesResponse,
  RequestOptions,
} from '../types.js';

/**
 * Client for Google-compatible interactions endpoints and Anthropic-compatible
 * messages endpoints.
 */
export class InteractionsClient extends BaseClient {
  /**
   * Generate content using the Google-compatible interactions endpoint.
   *
   * @param model - The model identifier to use for generation.
   * @param body - The interactions request body.
   * @param options - Optional request options.
   * @returns The interactions response with generated candidates.
   */
  async generateContent(
    model: string,
    body: InteractionsRequest,
    options?: RequestOptions,
  ): Promise<InteractionsResponse> {
    const encodedModel = encodeURIComponent(model);
    return this.post<InteractionsResponse>(
      `/v3/interactions/${encodedModel}:generateContent`,
      body,
      options,
    );
  }

  /**
   * Stream generated content using the Google-compatible interactions endpoint.
   *
   * @param model - The model identifier to use for generation.
   * @param body - The interactions request body.
   * @param options - Optional request options.
   * @returns An async generator yielding streamed interaction response chunks.
   */
  async *streamGenerateContent(
    model: string,
    body: InteractionsRequest,
    options?: RequestOptions,
  ): AsyncGenerator<InteractionsResponse> {
    const encodedModel = encodeURIComponent(model);
    // Build a request body with stream: true without relying on the
    // InteractionsRequest type having a stream field.
    const streamBody: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
      stream: true,
    };
    yield* this.stream<InteractionsResponse>(
      `/v3/interactions/${encodedModel}:streamGenerateContent`,
      streamBody,
      options,
    );
  }

  /**
   * Create a message using the Anthropic-compatible messages endpoint.
   *
   * @param body - The messages request body.
   * @param options - Optional request options.
   * @returns The messages response.
   */
  async createMessage(
    body: MessagesRequest,
    options?: RequestOptions,
  ): Promise<MessagesResponse> {
    return this.post<MessagesResponse>(
      '/v3/messages',
      body,
      options,
    );
  }

  /**
   * Stream a message using the Anthropic-compatible messages endpoint.
   *
   * @param body - The messages request body.
   * @param options - Optional request options.
   * @returns An async generator yielding streamed message response chunks.
   */
  async *streamMessage(
    body: Omit<MessagesRequest, 'stream'> & { readonly stream?: boolean },
    options?: RequestOptions,
  ): AsyncGenerator<MessagesResponse> {
    const streamBody: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
      stream: true,
    };
    yield* this.stream<MessagesResponse>(
      '/v3/messages',
      streamBody,
      options,
    );
  }
}

