import { BaseClient } from '../client-base.js';
import type { RequestOptions } from '../client-base.js';

/**
 * Response from the health check endpoint.
 */
export interface HealthCheckResponse {
  /** Health status of the server (e.g., "ok") */
  readonly status?: string;
}

/**
 * Client for interacting with System endpoints.
 *
 * Provides a health check endpoint for verifying server availability
 * and readiness. No authentication is required for this endpoint.
 */
export class SystemClient extends BaseClient {
  /**
   * Health check
   *
   * Returns server health and readiness status.
   *
   * @param options - Optional request options (headers, signal, etc.)
   * @returns A promise resolving to the health check response containing server status.
   */
  async healthCheck(options?: RequestOptions): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health', options);
  }
}

