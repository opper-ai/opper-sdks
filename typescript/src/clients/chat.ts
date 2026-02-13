import { BaseClient } from '../client-base.js';
import type { ClientConfig, RequestOptions } from '../client-base.js';
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
} from '../types.js';

/**
 * Client for OpenAI-compatible chat completions.
 *
 * Provides methods for creating chat completions with support
 * for both standard request/response and Server-Sent Events
 * streaming patterns.
 */
export class ChatClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * Create a chat completion.
   *
   * Sends a list of messages to the model and returns the assistant's
   * response. Supports tool calls, function calling, and various
   * generation parameters.
   *
   * @param body - The chat completion request
   * @param options - Optional request options
   * @returns The chat completion response
   */
  async create(
    body: ChatRequest,
    options?: RequestOptions,
  ): Promise<ChatResponse> {
    return this.post<ChatResponse>(
      '/v3/chat/completions',
      { ...body, stream: false },
      options,
    );
  }

  /**
   * Create a streaming chat completion.
   *
   * Sends a list of messages to the model and returns an async generator
   * that yields parsed {@link ChatStreamChunk} objects as they arrive
   * via Server-Sent Events.
   *
   * The `stream` field on the request is automatically set to `true`.
   *
   * @param body - The chat completion request
   * @param options - Optional request options
   * @returns An async generator yielding stream chunks
   *
   * @example
   * ```ts
   * const chat = new ChatClient({ apiKey: 'my-key' });
   * for await (const chunk of chat.createStream({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] })) {
   *   const delta = chunk.choices?.[0]?.delta;
   *   if (delta?.content) process.stdout.write(delta.content);
   * }
   * ```
   */
  async *createStream(
    body: ChatRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ChatStreamChunk, void, undefined> {
    yield* this.streamJson<ChatStreamChunk>(
      '/v3/chat/completions',
      { ...body, stream: true },
      options,
    );
  }
}

