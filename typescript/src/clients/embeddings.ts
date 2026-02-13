// =============================================================================
// Task API SDK - Embeddings Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { ClientConfig } from '../client-base.js';
import type {
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsUsageInfo,
} from '../types.js';

/**
 * OpenAI-compatible embeddings client.
 *
 * Currently no endpoints are defined in the API specification for embeddings,
 * but the schema types exist for future implementation. This client serves as
 * a placeholder that will be extended with methods as endpoints become available.
 */
export class EmbeddingsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

// Re-export related types for convenience
export type {
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsUsageInfo,
};

