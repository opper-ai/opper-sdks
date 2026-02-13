// =============================================================================
// Task API SDK - Interactions Client (Google-compatible)
// =============================================================================

import { BaseClient, ClientConfig } from '../client-base.js';
import type {
  InteractionsError,
  InteractionsFunction,
  InteractionsOutput,
  InteractionsRequest,
  InteractionsResponse,
  InteractionsTool,
  InteractionsUsage,
} from '../types.js';

/**
 * Google-compatible interactions client.
 *
 * Currently no endpoints are defined in the API specification,
 * but schemas exist for future implementation. This client serves
 * as a placeholder and will be populated with methods as endpoints
 * are added to the spec.
 *
 * Related schemas:
 * - {@link InteractionsError}
 * - {@link InteractionsFunction}
 * - {@link InteractionsOutput}
 * - {@link InteractionsRequest}
 * - {@link InteractionsResponse}
 * - {@link InteractionsTool}
 * - {@link InteractionsUsage}
 */
export class InteractionsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

