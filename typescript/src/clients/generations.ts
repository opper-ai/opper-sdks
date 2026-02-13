// =============================================================================
// Task API SDK - Generations Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { RequestOptions } from '../types.js';

// -----------------------------------------------------------------------------
// Generations Response Types
// -----------------------------------------------------------------------------

/** Pagination metadata for generations listing. */
export interface GenerationsListMeta {
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
  readonly total_pages: number;
}

/** Response from listing generations. */
export interface GenerationsListResponse {
  readonly data: Record<string, unknown>[];
  readonly meta: GenerationsListMeta;
}

/** Response from deleting a generation. */
export interface GenerationDeleteResponse {
  readonly deleted: boolean;
}

// -----------------------------------------------------------------------------
// Generations Client
// -----------------------------------------------------------------------------

/**
 * Client for managing recorded HTTP request/response generations.
 * Provides methods for listing, retrieving, and deleting generations
 * with pagination support.
 */
export class GenerationsClient extends BaseClient {
  /**
   * List recorded HTTP request/response generations with pagination.
   *
   * @param page - Page number (default 1)
   * @param pageSize - Items per page (default 50)
   * @param options - Additional request options
   * @returns Paginated list of generations with metadata
   */
  async listGenerations(
    page?: number,
    pageSize?: number,
    options?: RequestOptions,
  ): Promise<GenerationsListResponse> {
    return this.get<GenerationsListResponse>(
      '/v3/generations',
      {
        page,
        page_size: pageSize,
      },
      options,
    );
  }

  /**
   * Get a specific recorded generation by ID.
   *
   * @param id - Generation ID
   * @param options - Additional request options
   * @returns The recorded generation with request and response data
   */
  async getGeneration(
    id: string,
    options?: RequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(
      `/v3/generations/${encodeURIComponent(id)}`,
      undefined,
      options,
    );
  }

  /**
   * Delete a specific recorded generation.
   *
   * @param id - Generation ID
   * @param options - Additional request options
   * @returns Object indicating whether the generation was deleted
   */
  async deleteGeneration(
    id: string,
    options?: RequestOptions,
  ): Promise<GenerationDeleteResponse> {
    return this.delete<GenerationDeleteResponse>(
      `/v3/generations/${encodeURIComponent(id)}`,
      options,
    );
  }
}

