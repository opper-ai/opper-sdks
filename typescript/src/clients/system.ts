// =============================================================================
// SystemClient – System API endpoints
// =============================================================================

import { BaseClient } from '../client-base.js';
import { ErrorResponse } from '../types.js';

/** Response from the health check endpoint */
export interface HealthCheckResponse {
  readonly status: string;
}

/**
 * Client for System-related API endpoints.
 *
 * Provides access to system health and status information.
 * Note: The health check endpoint does not require authentication.
 */
export class SystemClient extends BaseClient {
  /**
   * Check the health status of the API server.
   *
   * @returns The server health status
   * @throws {ApiError} if the request fails
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health');
  }
}

