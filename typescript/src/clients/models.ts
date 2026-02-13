import { BaseClient } from '../client-base.js';
import type { ModelsResponse } from '../types.js';

/**
 * Client for the Models API endpoints.
 * Provides methods to list available models and their capabilities.
 * No authentication is required for these endpoints.
 */
export class ModelsClient extends BaseClient {
  /**
   * List all available models with their capabilities and parameters.
   *
   * @returns A promise that resolves to a ModelsResponse containing the list of models.
   *
   * @example
   * ```typescript
   * const client = new ModelsClient({ apiKey: '' });
   * const response = await client.listModels();
   * console.log(response.models);
   * ```
   */
  async listModels(): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/v3/models');
  }
}

