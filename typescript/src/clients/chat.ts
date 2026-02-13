// =============================================================================
// Task API SDK - Chat Client
// =============================================================================

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
} from '../types.js';

/**
 * OpenAI-compatible chat completions client.
 *
 * This client provides access to Chat API functionality.
 * Currently no endpoints are defined in the spec, but schemas exist
 * for future implementation.
 */
export class ChatClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

// Re-export related types for convenience
export type {
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
};

