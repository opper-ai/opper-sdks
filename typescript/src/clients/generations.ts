// =============================================================================
// Task API SDK - Generations Client
// =============================================================================

import { BaseClient } from "../client-base.js";
import type { RequestOptions, UsageInfo } from "../types.js";

// -----------------------------------------------------------------------------
// Generations-specific Types
// -----------------------------------------------------------------------------

/** A recorded generation (function call). */
export interface Generation {
  readonly id: string;
  readonly function_name: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly created_at: string;
  readonly model?: string;
  readonly usage?: UsageInfo;
}

/** Pagination metadata for generation listings. */
export interface GenerationsListMeta {
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
  readonly total_pages: number;
}

/** Response from listing generations. */
export interface GenerationsListResponse {
  readonly data: Generation[];
  readonly meta: GenerationsListMeta;
}

/** Parameters for listing generations. */
export interface ListGenerationsParams {
  /** Semantic search query (uses hybrid dense+sparse search). */
  query?: string;
  /** Page number (default 1). */
  page?: number;
  /** Items per page (default 50). */
  page_size?: number;
}

/** Response from deleting a generation. */
export interface DeleteGenerationResponse {
  readonly deleted: boolean;
}

// -----------------------------------------------------------------------------
// Generations Client
// -----------------------------------------------------------------------------

/**
 * Client for the Generations API endpoints.
 * Provides methods to list, get, and delete recorded HTTP request/response generations.
 */
export class GenerationsClient extends BaseClient {
  /**
   * List recorded HTTP request/response generations with pagination.
   *
   * @param params - Optional query parameters for filtering and pagination.
   * @param options - Optional request options.
   * @returns A paginated list of generations.
   */
  async listGenerations(
    params?: ListGenerationsParams,
    options?: RequestOptions,
  ): Promise<GenerationsListResponse> {
    return this.get<GenerationsListResponse>(
      "/v3/generations",
      {
        query: params?.query,
        page: params?.page,
        page_size: params?.page_size,
      },
      options,
    );
  }

  /**
   * Get a specific recorded generation by ID.
   *
   * @param id - The generation ID.
   * @param options - Optional request options.
   * @returns The recorded generation with request and response data.
   */
  async getGeneration(id: string, options?: RequestOptions): Promise<Generation> {
    return this.get<Generation>(`/v3/generations/${encodeURIComponent(id)}`, undefined, options);
  }

  /**
   * Delete a specific recorded generation.
   *
   * @param id - The generation ID.
   * @param options - Optional request options.
   * @returns Confirmation of deletion.
   */
  async deleteGeneration(id: string, options?: RequestOptions): Promise<DeleteGenerationResponse> {
    return this.delete<DeleteGenerationResponse>(
      `/v3/generations/${encodeURIComponent(id)}`,
      options,
    );
  }
}
