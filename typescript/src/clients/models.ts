import { BaseClient } from '../client-base.js';
import type { ModelsResponse } from '../types.js';

/**
 * Client for the Models API endpoints.
 * Provides methods to list available models and their capabilities.
 * No authentication is required for this endpoint.
 */
export class ModelsClient extends BaseClient {
  /**
   * List all available models with their capabilities and parameters.
   *
   * @returns A promise that resolves with the models response containing the list of models.
   */
  async listModels(): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/v3/models');
  }
}

