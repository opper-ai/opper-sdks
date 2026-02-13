// =============================================================================
// Task API SDK - Chat Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  RequestOptions,
} from '../types.js';

/** Path for the OpenAI-compatible chat completions endpoint. */
const CHAT_COMPLETIONS_PATH = '/v1/chat/completions';

/**
 * ChatClient extending BaseClient.
 * Provides OpenAI-compatible chat completions endpoint methods.
 */
export class ChatClient extends BaseClient {
  /**
   * Create a chat completion.
   *
   * Sends a list of messages to the model and returns a complete chat
   * completion response. For streaming responses, use {@link streamCompletion}.
   *
   * @param body - The chat completion request body.
   * @param options - Optional request options (headers, signal).
   * @returns The chat completion response.
   */
  async createCompletion(
    body: ChatRequest,
    options?: RequestOptions,
  ): Promise<ChatResponse> {
    // Ensure stream is not set or is false for non-streaming requests
    const requestBody: ChatRequest = { ...body, stream: false };
    return this.post<ChatResponse>(CHAT_COMPLETIONS_PATH, requestBody, options);
  }

  /**
   * Create a streaming chat completion.
   *
   * Sends a list of messages to the model and returns an async generator
   * that yields streaming chat completion chunks via Server-Sent Events.
   *
   * @param body - The chat completion request body. The `stream` field will
   *   be automatically set to `true`.
   * @param options - Optional request options (headers, signal).
   * @returns An async generator yielding chat stream chunks.
   */
  async *streamCompletion(
    body: ChatRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ChatStreamChunk, void, undefined> {
    // Ensure stream is set to true for streaming requests
    const requestBody: ChatRequest = { ...body, stream: true };
    yield* this.stream<ChatStreamChunk>(CHAT_COMPLETIONS_PATH, requestBody, options);
  }
}

