import { BaseClient } from '../client-base.js';
import type { ClientConfig } from '../client-base.js';
import type {
  ListGenerationsResponse,
  GetGenerationResponse,
  DeleteGenerationResponse,
} from '../types.js';

/**
 * Client for managing recorded HTTP request/response generations.
 *
 * Provides methods for listing, retrieving, and deleting generations
 * with pagination support.
 */
export class GenerationsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * List recorded HTTP request/response generations with pagination.
   *
   * @param page - Page number (default 1)
   * @param pageSize - Items per page (default 50)
   * @returns A paginated list of generations
   */
  async listGenerations(
    page?: number,
    pageSize?: number,
  ): Promise<ListGenerationsResponse> {
    return this.get<ListGenerationsResponse>('/v3/generations', {
      query: {
        page,
        page_size: pageSize,
      },
    });
  }

  /**
   * Get a specific recorded generation by ID.
   *
   * @param id - Generation ID
   * @returns The generation record with request and response data
   */
  async getGeneration(id: string): Promise<GetGenerationResponse> {
    return this.get<GetGenerationResponse>(
      `/v3/generations/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Delete a specific recorded generation.
   *
   * @param id - Generation ID
   * @returns An object indicating whether the deletion was successful
   */
  async deleteGeneration(id: string): Promise<DeleteGenerationResponse> {
    return this.delete<DeleteGenerationResponse>(
      `/v3/generations/${encodeURIComponent(id)}`,
    );
  }
}

