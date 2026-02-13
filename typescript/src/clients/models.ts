// =============================================================================
// Models Client for Task API SDK
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { ModelsResponse } from '../types.js';

/**
 * Client for the Models API endpoints.
 * Provides methods to list available models with their capabilities and parameters.
 */
export class ModelsClient extends BaseClient {
  /**
   * List all available models with their capabilities and parameters.
   *
   * @returns A response containing an array of model information objects.
   */
  async listModels(): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/v3/models');
  }
}

