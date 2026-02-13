import { BaseClient } from '../client-base.js';
import type { ClientConfig } from '../client-base.js';
import type {
  EmbeddingsRequest,
  EmbeddingsResponse,
} from '../types.js';

/**
 * Client for OpenAI-compatible embeddings endpoints.
 *
 * Provides methods for generating vector embeddings from text input
 * using the OpenAI-compatible `/v1/embeddings` endpoint.
 *
 * Related schemas: EmbeddingsRequest, EmbeddingsResponse,
 * EmbeddingsDataItem, EmbeddingsUsageInfo.
 */
export class EmbeddingsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * Create embeddings for the given input.
   *
   * Generates vector embeddings from text input using the specified model.
   * Compatible with the OpenAI embeddings API format.
   *
   * @param request - The embeddings request containing input text and model configuration.
   * @returns The embeddings response containing embedding vectors and usage information.
   */
  async create(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
    return this.post<EmbeddingsResponse>('/v1/embeddings', request);
  }
}

