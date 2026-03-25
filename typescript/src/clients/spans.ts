import { BaseClient } from "../client-base.js";
import type {
  CreateSpanRequest,
  CreateSpanResponse,
  GetSpanResponse,
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

  /**
   * Get a span by ID.
   * GET /v3/spans/{id}
   */
  async getSpan(id: string, options?: RequestOptions): Promise<GetSpanResponse> {
    return this.get<GetSpanResponse>(`/v3/spans/${encodeURIComponent(id)}`, undefined, options);
  }

  /**
   * Delete a span.
   * DELETE /v3/spans/{id}
   */
  async deleteSpan(id: string, options?: RequestOptions): Promise<void> {
    return this.delete<void>(`/v3/spans/${encodeURIComponent(id)}`, options);
  }
}
