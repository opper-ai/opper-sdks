import { BaseClient } from '../client-base.js';
import type { ClientConfig } from '../client-base.js';
import type {
  EmbeddingsDataItem,
  EmbeddingsRequest,
  EmbeddingsResponse,
  EmbeddingsUsageInfo,
  ErrorResponse,
} from '../types.js';

/**
 * Client for OpenAI-compatible embeddings endpoints.
 *
 * Currently a stub with no endpoints but prepared for future implementation.
 * Related schemas: EmbeddingsDataItem, EmbeddingsRequest, EmbeddingsResponse,
 * EmbeddingsUsageInfo, ErrorResponse.
 */
export class EmbeddingsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }
}

