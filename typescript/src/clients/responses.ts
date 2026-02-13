// =============================================================================
// Task API SDK - Responses Client
// =============================================================================

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
} from '../types.js';

/**
 * Client for the OpenAI Responses API compatible endpoints.
 *
 * Currently no endpoints are defined in the specification, but schemas exist
 * for future implementation. This class serves as a placeholder and will be
 * populated with methods as endpoints are added to the API.
 */
export class ResponsesClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

// Re-export related types for convenience
export type {
  ResponsesError,
  ResponsesOutputContent,
  ResponsesOutputItem,
  ResponsesRequest,
  ResponsesResponse,
  ResponsesTool,
  ResponsesUsage,
};

