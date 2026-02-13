import { BaseClient } from '../client-base.js';
import type { ClientConfig } from '../client-base.js';
import type {
  ChatChoice,
  ChatFunctionCall,
  ChatMessage,
  ChatRequest,
  ChatRequestMessage,
  ChatRequestTool,
  ChatRequestToolFunction,
  ChatResponse,
  ChatStreamChoice,
  ChatStreamChunk,
  ChatStreamDelta,
  ChatToolCall,
  ChatUsage,
  StreamOptions,
  ErrorResponse,
} from '../types.js';

/**
 * Client for OpenAI-compatible chat completions.
 *
 * Currently a stub prepared for future implementation.
 * Related schemas support chat completion request/response patterns
 * including streaming.
 */
export class ChatClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

