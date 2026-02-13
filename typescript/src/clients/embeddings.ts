// =============================================================================
// Embeddings Client for Task API SDK
// =============================================================================

import { BaseClient, ClientConfig, RequestOptions } from '../client-base.js';
import { EmbeddingsRequest, EmbeddingsResponse } from '../types.js';

/**
 * Client for the Embeddings API endpoints.
 * Provides methods to create embeddings from input text.
 */
export class EmbeddingsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * Create embeddings
   *
   * OpenAI-compatible embeddings endpoint.
   *
   * @param body - The embeddings request body
   * @param options - Optional request options
   * @returns The embeddings response containing embedding vectors and usage info
   */
  async createEmbeddings(
    body: EmbeddingsRequest,
    options?: RequestOptions,
  ): Promise<EmbeddingsResponse> {
    return this.post<EmbeddingsResponse>('/v3/embeddings', body, options);
  }
}

