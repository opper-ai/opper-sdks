import { BaseClient } from "../client-base.js";
import type { MessagesRequest, MessagesResponse, RequestOptions } from "../types.js";

/** Path for the Anthropic-compatible messages endpoint. */
const MESSAGES_PATH = "/v3/compat/v1/messages";

/**
 * Client for Anthropic-compatible messages endpoints.
 */
export class MessagesClient extends BaseClient {
  /**
   * Create a message using the Anthropic-compatible messages endpoint.
   * POST /v3/compat/v1/messages
   */
  async create(body: MessagesRequest, options?: RequestOptions): Promise<MessagesResponse> {
    const requestBody: MessagesRequest = { ...body, stream: false };
    return this.post<MessagesResponse>(MESSAGES_PATH, requestBody, options);
  }

  /**
   * Stream a message using the Anthropic-compatible messages endpoint.
   * POST /v3/compat/v1/messages (SSE)
   */
  async *createStream(
    body: MessagesRequest,
    options?: RequestOptions,
  ): AsyncGenerator<MessagesResponse, void, undefined> {
    const streamBody: MessagesRequest = { ...body, stream: true };
    yield* this.stream<MessagesResponse>(MESSAGES_PATH, streamBody, options);
  }
}
