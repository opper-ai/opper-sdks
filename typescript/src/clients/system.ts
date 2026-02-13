// =============================================================================
// Task API SDK - System Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { HealthCheckResponse } from '../types.js';

/**
 * SystemClient provides access to system-level API endpoints.
 *
 * Methods:
 * - healthCheck(): Returns server health and readiness status.
 */
export class SystemClient extends BaseClient {
  /**
   * Health check
   *
   * Returns server health and readiness status.
   * No authentication required.
   *
   * @returns The health check response with server status
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health');
  }
}

