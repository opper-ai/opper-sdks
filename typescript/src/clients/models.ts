// =============================================================================
// Task API SDK - Models Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { ModelsResponse, RequestOptions } from '../types.js';

/**
 * Client for the Models API.
 * Provides access to the model registry with capabilities, pricing, and parameters.
 */
export class ModelsClient extends BaseClient {
  /**
   * List all available models with their capabilities and parameters.
   *
   * @param options - Optional request options (headers, signal).
   * @returns A promise that resolves to the models response containing the model registry.
   */
  async listModels(options?: RequestOptions): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/v3/models', undefined, options);
  }
}

