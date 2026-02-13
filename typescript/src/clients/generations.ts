// =============================================================================
// Task API SDK - Generations Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type {
  ListGenerationsResponse,
  DeleteGenerationResponse,
} from '../types.js';

/**
 * Options for listing generations with pagination.
 */
export interface ListGenerationsOptions {
  /** Page number (default 1) */
  readonly page?: number;
  /** Items per page (default 50) */
  readonly pageSize?: number;
}

/**
 * Client for managing recorded HTTP request/response generations.
 *
 * Provides methods to list, retrieve, and delete generations
 * with pagination support.
 */
export class GenerationsClient extends BaseClient {
  /**
   * List recorded HTTP request/response generations with pagination.
   *
   * @param options - Optional pagination parameters
   * @returns A paginated list of generations
   */
  async listGenerations(
    options?: ListGenerationsOptions,
  ): Promise<ListGenerationsResponse> {
    return this.get<ListGenerationsResponse>('/v3/generations', {
      queryParams: {
        page: options?.page,
        page_size: options?.pageSize,
      },
    });
  }

  /**
   * Get a specific recorded generation by ID.
   *
   * @param id - Generation ID
   * @returns The recorded generation with request and response data
   */
  async getGeneration(id: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(
      `/v3/generations/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Delete a specific recorded generation.
   *
   * @param id - Generation ID
   * @returns Confirmation of deletion
   */
  async deleteGeneration(id: string): Promise<DeleteGenerationResponse> {
    return this.delete<DeleteGenerationResponse>(
      `/v3/generations/${encodeURIComponent(id)}`,
    );
  }
}

