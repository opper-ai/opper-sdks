// =============================================================================
// Task API SDK - Embeddings Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type {
  EmbeddingsRequest,
  EmbeddingsResponse,
  RequestOptions,
} from '../types.js';

/**
 * EmbeddingsClient provides OpenAI-compatible embeddings endpoint methods.
 * Extends BaseClient with Bearer authentication and JSON serialization.
 */
export class EmbeddingsClient extends BaseClient {
  /**
   * Create embeddings for the given input.
   *
   * Sends a POST request to `/v1/embeddings` with the provided request body
   * and returns the embedding vectors along with usage information.
   *
   * @param body - The embeddings request containing input text(s) and model.
   * @param options - Optional request options (headers, abort signal).
   * @returns The embeddings response with data items and usage info.
   */
  async create(
    body: EmbeddingsRequest,
    options?: RequestOptions,
  ): Promise<EmbeddingsResponse> {
    return this.post<EmbeddingsResponse>('/v1/embeddings', body, options);
  }
}

