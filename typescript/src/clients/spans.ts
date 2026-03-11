import { BaseClient } from "../client-base.js";
import type {
  CreateSpanRequest,
  CreateSpanResponse,
  RequestOptions,
  UpdateSpanRequest,
} from "../types.js";

/**
 * Client for the Spans API endpoints.
 * Provides methods to create and update trace spans.
 */
export class SpansClient extends BaseClient {
  /**
   * Create a trace span.
   * POST /v3/spans
   */
  async create(body: CreateSpanRequest, options?: RequestOptions): Promise<CreateSpanResponse> {
    return this.post<CreateSpanResponse>("/v3/spans", body, options);
  }

  /**
   * Update an existing span.
   * PATCH /v3/spans/{id}
   */
  async update(id: string, body: UpdateSpanRequest, options?: RequestOptions): Promise<void> {
    return this.patch<void>(`/v3/spans/${encodeURIComponent(id)}`, body, options);
  }
}
