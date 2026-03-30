import { BaseClient } from "../client-base.js";
import type { ModelsResponse, RequestOptions } from "../types.js";

/** Query parameters for listing models. */
export interface ListModelsParams {
  /** Filter by model type: "llm", "embedding", "image", "video", "tts", "stt", "rerank", "ocr", "realtime". */
  readonly type?: string;
  /** Filter by provider name, e.g. "openai", "anthropic". */
  readonly provider?: string;
  /** Search models by name or description. */
  readonly q?: string;
  /** Filter by capability, e.g. "vision", "tools". Can be specified multiple times. */
  readonly capability?: string | string[];
  /** Include deprecated models. Defaults to false. */
  readonly deprecated?: boolean;
  /** Sort field: "id", "type", "provider". Defaults to "id". */
  readonly sort?: string;
  /** Sort order: "asc" or "desc". Defaults to "asc". */
  readonly order?: string;
  /** Number of results to return (1-500, default 50). */
  readonly limit?: number;
  /** Offset for pagination. */
  readonly offset?: number;
}

/**
 * Client for the Models API endpoints.
 * Provides methods to list available models with their capabilities,
 * pricing, and parameters.
 *
 * No authentication is required for these endpoints.
 */
export class ModelsClient extends BaseClient {
  /**
   * List available models with optional filtering.
   *
   * GET /v3/models
   */
  async listModels(params?: ListModelsParams, options?: RequestOptions): Promise<ModelsResponse> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (params?.type) query.type = params.type;
    if (params?.provider) query.provider = params.provider;
    if (params?.q) query.q = params.q;
    if (params?.capability) {
      const caps = Array.isArray(params.capability) ? params.capability : [params.capability];
      query.capability = caps.join(",");
    }
    if (params?.deprecated) query.deprecated = "true";
    if (params?.sort) query.sort = params.sort;
    if (params?.order) query.order = params.order;
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;
    return this.get<ModelsResponse>(
      "/v3/models",
      Object.keys(query).length > 0 ? query : undefined,
      options,
    );
  }
}
