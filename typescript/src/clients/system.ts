import { BaseClient } from '../client-base.js';
import type { ErrorResponse } from '../types.js';

/** Response from the health check endpoint. */
export interface HealthCheckResponse {
  readonly status: string;
}

/**
 * SystemClient provides access to system-level endpoints.
 * Covers GET /v3/health. No auth required.
 */
export class SystemClient extends BaseClient {
  /**
   * Returns server health and readiness status.
   *
   * @returns The health status of the server.
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/v3/health');
  }
}

