import { BaseClient } from "../client-base.js";
import type { RequestOptions } from "../types.js";

/** Health check response from the server. */
export interface HealthCheckResponse {
  readonly status: string;
}

/**
 * Client for the System API endpoints.
 * Provides methods to check server health status.
 *
 * No authentication is required for these endpoints.
 */
export class SystemClient extends BaseClient {
  /**
   * Check server health status.
   *
   * GET /health
   *
   * @param options - Optional request options (headers, signal, etc.)
   * @returns A promise that resolves with the health check response.
   */
  async healthCheck(options?: RequestOptions): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>("/health", undefined, options);
  }
}
