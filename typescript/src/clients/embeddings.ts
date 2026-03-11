// =============================================================================
// Task API SDK - Embeddings Client
// =============================================================================

import { BaseClient } from "../client-base.js";
import type { EmbeddingsRequest, EmbeddingsResponse, RequestOptions } from "../types.js";

/** Path for the OpenAI-compatible embeddings endpoint. */
const EMBEDDINGS_PATH = "/v3/compat/embeddings";

/**
 * EmbeddingsClient extending BaseClient.
 * Provides OpenAI-compatible embedding endpoint methods for generating
 * vector embeddings from text input.
 */
export class EmbeddingsClient extends BaseClient {
  /**
   * Create embeddings for the given input.
   *
   * Sends text input to the specified model and returns vector embeddings.
   * Supports single strings or arrays of strings as input.
   *
   * @param body - The embeddings request body containing input text and model.
   * @param options - Optional request options (headers, signal).
   * @returns The embeddings response containing vector data and usage info.
   */
  async createEmbedding(
    body: EmbeddingsRequest,
    options?: RequestOptions,
  ): Promise<EmbeddingsResponse> {
    return this.post<EmbeddingsResponse>(EMBEDDINGS_PATH, body, options);
  }
}
