// =============================================================================
// Task API SDK - Generations Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { RequestOptions } from '../types.js';

// -----------------------------------------------------------------------------
// Generations-specific response types
// -----------------------------------------------------------------------------

/** Pagination metadata for list responses. */
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

/** A single recorded generation with request and response data. */
export type Generation = Record<string, unknown>;

/** Response from deleting a generation. */
export interface GenerationDeleteResponse {
  readonly deleted: boolean;
}

// -----------------------------------------------------------------------------
// Client
// -----------------------------------------------------------------------------

/**
 * Client for the Generations API.
 * Provides methods to list, retrieve, and delete recorded HTTP request/response
 * generations.
 */
export class GenerationsClient extends BaseClient {
  /**
   * List recorded generations with pagination.
   *
   * @param page - Page number (default 1).
   * @param pageSize - Number of items per page (default 50).
   * @param options - Optional request options (headers, signal).
   * @returns A promise that resolves to the paginated list of generations.
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
   * @param id - The generation ID.
   * @param options - Optional request options (headers, signal).
   * @returns A promise that resolves to the generation object.
   */
  async getGeneration(
    id: string,
    options?: RequestOptions,
  ): Promise<Generation> {
    return this.get<Generation>(
      `/v3/generations/${encodeURIComponent(id)}`,
      undefined,
      options,
    );
  }

  /**
   * Delete a specific recorded generation.
   *
   * @param id - The generation ID.
   * @param options - Optional request options (headers, signal).
   * @returns A promise that resolves to the deletion confirmation.
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

