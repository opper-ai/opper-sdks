// =============================================================================
// Task API SDK - Models Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { ModelsResponse } from '../types.js';

/**
 * Client for the Models API endpoints.
 *
 * Provides methods to list available models with their capabilities,
 * pricing, and parameters.
 *
 * Note: The models endpoint does not require authentication.
 */
export class ModelsClient extends BaseClient {
  /**
   * List all available models with their capabilities and parameters.
   *
   * @returns A promise that resolves to the models response containing
   *          the list of available models, total count, offset, and limit.
   *
   * @example
   * ```typescript
   * const client = new ModelsClient({ apiKey: '' });
   * const response = await client.listModels();
   * for (const model of response.models) {
   *   console.log(`${model.name} (${model.provider}): ${model.description}`);
   * }
   * ```
   */
  async listModels(): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/v3/models');
  }
}

