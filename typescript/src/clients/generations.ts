import { BaseClient } from '../client-base.js';
import type { RequestOptions } from '../client-base.js';
import type {
  ListGenerationsResponse,
  GetGenerationResponse,
  DeleteGenerationResponse,
} from '../types.js';

/**
 * Query parameters for listing generations.
 */
export interface ListGenerationsParams {
  /** Page number (1-based) */
  readonly page?: number;
  /** Number of items per page */
  readonly page_size?: number;
}

/**
 * Client for the Generations API endpoints.
 *
 * Provides access to listing, retrieving, and deleting generations.
 */
export class GenerationsClient extends BaseClient {
  /**
   * List generations with optional pagination.
   *
   * @param params - Optional pagination parameters (page, page_size).
   * @param options - Optional request options (headers, signal, etc.).
   * @returns A promise resolving to the paginated generations listing response.
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
   * Get a specific generation by ID.
   *
   * @param id - The generation ID.
   * @param options - Optional request options (headers, signal, etc.).
   * @returns A promise resolving to the generation details.
   */
  async getGeneration(
    id: string,
    options?: RequestOptions,
  ): Promise<GetGenerationResponse> {
    return this.get<GetGenerationResponse>(
      `/v3/generations/${encodeURIComponent(id)}`,
      options,
    );
  }

  /**
   * Delete a specific generation by ID.
   *
   * @param id - The generation ID.
   * @param options - Optional request options (headers, signal, etc.).
   * @returns A promise resolving to the deletion confirmation.
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

