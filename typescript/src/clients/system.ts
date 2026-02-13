// =============================================================================
// Task API SDK - System Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import { ClientConfig, RequestOptions } from '../types.js';

/** Response from the health check endpoint. */
export interface HealthCheckResponse {
  readonly status: string;
}

/**
 * SystemClient extending BaseClient.
 * Provides access to system-level endpoints such as health checks.
 * No authentication required for these endpoints.
 */
export class SystemClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * Health check.
   * Returns server health and readiness status.
   * No authentication required.
   */
  async healthCheck(options?: RequestOptions): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health', undefined, options);
  }
}

