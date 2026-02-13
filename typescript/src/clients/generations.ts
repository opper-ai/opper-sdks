// =============================================================================
// Generations Client for Task API SDK
// =============================================================================

import { BaseClient, ClientConfig, RequestOptions } from '../client-base.js';
import {
  ListGenerationsResponse,
  GenerationDetail,
  DeleteGenerationResponse,
} from '../types.js';

/** Query parameters for listing generations */
export interface ListGenerationsParams {
  /** Page number (default 1) */
  page?: number;
  /** Items per page (default 50) */
  page_size?: number;
}

/**
 * Client for the Generations API endpoints.
 * Provides methods for listing, retrieving, and deleting recorded HTTP
 * request/response generations with pagination support.
 */
export class GenerationsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * List recorded HTTP request/response generations with pagination.
   *
   * @param params - Optional pagination parameters (page, page_size)
   * @param options - Optional request options (headers, signal)
   * @returns A paginated list of generations with metadata
   */
  async listGenerations(
    params?: ListGenerationsParams,
    options?: RequestOptions,
  ): Promise<ListGenerationsResponse> {
    return this.get<ListGenerationsResponse>('/v3/generations', {
      ...options,
      query: {
        ...options?.query,
        page: params?.page,
        page_size: params?.page_size,
      },
    });
  }

  /**
   * Get a specific recorded generation by ID.
   *
   * @param id - Generation ID
   * @param options - Optional request options (headers, signal)
   * @returns The recorded generation with request and response data
   */
  async getGeneration(
    id: string,
    options?: RequestOptions,
  ): Promise<GenerationDetail> {
    return this.get<GenerationDetail>(
      `/v3/generations/${encodeURIComponent(id)}`,
      options,
    );
  }

  /**
   * Delete a specific recorded generation.
   *
   * @param id - Generation ID
   * @param options - Optional request options (headers, signal)
   * @returns An object indicating whether the generation was deleted
   */
  async deleteGeneration(
    id: string,
    options?: RequestOptions,
  ): Promise<DeleteGenerationResponse> {
    return this.delete<DeleteGenerationResponse>(
      `/v3/generations/${encodeURIComponent(id)}`,
      options,
    );
  }
}

