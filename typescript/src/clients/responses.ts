import { BaseClient } from '../client-base.js';
import type { ClientConfig } from '../client-base.js';
import type {
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesRequest,
  ResponsesResponse,
  ResponsesTool,
  ResponsesUsage,
  ErrorResponse,
} from '../types.js';

/**
 * Client for the OpenAI Responses API compatible endpoint.
 *
 * Currently a stub with no endpoints but prepared for future implementation.
 */
export class ResponsesClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

