import { BaseClient } from '../client-base.js';
import type { ModelsResponse } from '../types.js';
import type { RequestOptions } from '../client-base.js';

/**
 * Client for the Models API endpoints.
 *
 * Provides access to listing available models with their capabilities
 * and parameters. No authentication is required for these endpoints.
 */
export class ModelsClient extends BaseClient {
  /**
   * List all available models with their capabilities and parameters.
   *
   * @param options - Optional request options (headers, signal, etc.)
   * @returns A promise resolving to the models listing response.
   */
  async listModels(options?: RequestOptions): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/v3/models', options);
  }
}

