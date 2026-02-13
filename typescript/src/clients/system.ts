import { BaseClient } from '../client-base.js';
import type { ClientConfig, RequestOptions } from '../client-base.js';

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
 * Provides a health check endpoint for verifying server availability.
 * No authentication is required for this endpoint.
 */
export class SystemClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * Health check
   *
   * Returns server health status.
   *
   * @param options - Optional request options (headers, signal, etc.)
   * @returns The health check response containing server status
   */
  async healthCheck(options?: RequestOptions): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health', {
      ...options,
      headers: {
        ...options?.headers,
      },
    });
  }
}

