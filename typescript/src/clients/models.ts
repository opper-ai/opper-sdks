import { BaseClient } from '../client-base.js';
import type { ModelsResponse, RequestOptions } from '../types.js';

/**
 * Client for the Models API endpoints.
 * Provides methods to list available models with their capabilities,
 * pricing, and parameters.
 *
 * No authentication is required for these endpoints.
 */
export class ModelsClient extends BaseClient {
  /**
   * List all available models with their capabilities, pricing, and parameters.
   *
   * GET /v3/models
   *
   * @param options - Optional request options (headers, signal, etc.)
   * @returns A promise that resolves with the models response containing the list of models.
   */
  async listModels(options?: RequestOptions): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/v3/models', undefined, options);
  }
}

