import { BaseClient } from "../client-base.js";
import type {
  GetTraceResponse,
  ListTracesParams,
  ListTracesResponse,
  RequestOptions,
} from "../types.js";

/**
 * Client for the Traces API endpoints.
 * Provides methods to list, get, and delete traces.
 */
export class TracesClient extends BaseClient {
  /**
   * List traces with pagination.
   * GET /v3/traces
   */
  async listTraces(
    params?: ListTracesParams,
    options?: RequestOptions,
  ): Promise<ListTracesResponse> {
    return this._get<ListTracesResponse>(
      "/v3/traces",
      {
        limit: params?.limit,
        offset: params?.offset,
        name: params?.name,
      },
      options,
    );
  }

  /**
   * Get a trace with all its spans.
   * GET /v3/traces/{id}
   */
  async getTrace(id: string, options?: RequestOptions): Promise<GetTraceResponse> {
    const res = await this._get<{ data: GetTraceResponse }>(
      `/v3/traces/${encodeURIComponent(id)}`,
      undefined,
      options,
    );
    return res.data;
  }

  /**
   * Delete a trace and all its spans.
   * DELETE /v3/traces/{id}
   */
  async deleteTrace(id: string, options?: RequestOptions): Promise<void> {
    return this._delete<void>(`/v3/traces/${encodeURIComponent(id)}`, options);
  }
}
