import { BaseClient } from '../client-base.js';
import type { ErrorResponse } from '../types.js';

/** Response from the health check endpoint. */
export interface HealthCheckResponse {
  readonly status: string;
}

/**
 * SystemClient provides access to system-level endpoints.
 * Methods: healthCheck (GET /health). No auth required.
 */
export class SystemClient extends BaseClient {
  /**
   * Health check
   *
   * Returns server health, readiness, and liveness status.
   *
   * @returns The health status of the server.
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health');
  }
}

