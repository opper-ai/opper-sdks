import { BaseClient } from '../client-base.js';
import type { ClientConfig } from '../client-base.js';
import type {
  InteractionsError,
  InteractionsFunction,
  InteractionsOutput,
  InteractionsRequest,
  InteractionsResponse,
  InteractionsTool,
  InteractionsUsage,
  ErrorResponse,
} from '../types.js';

/**
 * Client for Google-compatible interactions endpoint.
 *
 * This client is currently a stub prepared for future implementation.
 * Related types are imported and available for use when endpoints are added.
 */
export class InteractionsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

