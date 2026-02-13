// =============================================================================
// ChatClient – Chat completions API
// =============================================================================

import { BaseClient, type RequestOptions } from '../client-base.js';
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
} from '../types.js';

/**
 * Client for the Chat API endpoints.
 *
 * Provides OpenAI-compatible chat completions with support for both
 * synchronous responses and Server-Sent Events (SSE) streaming.
 */
export class ChatClient extends BaseClient {
  /**
   * Create a chat completion.
   *
   * Sends messages to the model and returns a complete response.
   * If `body.stream` is set to `true`, consider using {@link chatCompletionsStream}
   * instead for streaming support.
   *
   * @param body - The chat completion request body
   * @param options - Optional request options (headers, signal, etc.)
   * @returns The chat completion response
   */
  async chatCompletions(
    body: ChatRequest,
    options?: RequestOptions,
  ): Promise<ChatResponse> {
    return this.post<ChatResponse>('/v3/chat/completions', body, options);
  }

  /**
   * Create a streaming chat completion.
   *
   * Sends messages to the model and returns an async iterable of streamed
   * chunks via Server-Sent Events. The `stream` field on the request body
   * is automatically set to `true`.
   *
   * The stream terminates when the server sends the `[DONE]` sentinel.
   *
   * @param body - The chat completion request body (stream is forced to true)
   * @param options - Optional request options (headers, signal, etc.)
   * @returns An async generator yielding ChatStreamChunk objects
   *
   * @example
   * ```ts
   * const client = new ChatClient({ apiKey: 'your-key' });
   * const stream = client.chatCompletionsStream({
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Hello!' }],
   * });
   * for await (const chunk of stream) {
   *   const delta = chunk.choices?.[0]?.delta?.content;
   *   if (delta) process.stdout.write(delta);
   * }
   * ```
   */
  async *chatCompletionsStream(
    body: ChatRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ChatStreamChunk, void, undefined> {
    const streamBody: ChatRequest = { ...body, stream: true };

    const sseStream = this.stream(
      'POST',
      '/v3/chat/completions',
      streamBody,
      options,
    );

    for await (const event of sseStream) {
      const chunk = this.parseSSEData<ChatStreamChunk>(event.data);
      if (chunk === null) {
        // Received [DONE] sentinel – stream is complete
        return;
      }
      yield chunk;
    }
  }
}

