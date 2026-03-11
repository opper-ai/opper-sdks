import { BaseClient } from "../client-base.js";
import type { InteractionsRequest, InteractionsResponse, RequestOptions } from "../types.js";

/** Path for the Google-compatible interactions endpoint. */
const INTERACTIONS_PATH = "/v3/compat/v1beta/interactions";

/**
 * Client for Google-compatible interactions endpoints.
 */
export class InteractionsClient extends BaseClient {
  /**
   * Generate content using the Google-compatible interactions endpoint.
   * POST /v3/compat/v1beta/interactions
   */
  async generateContent(
    body: InteractionsRequest,
    options?: RequestOptions,
  ): Promise<InteractionsResponse> {
    return this.post<InteractionsResponse>(INTERACTIONS_PATH, body, options);
  }

  /**
   * Stream generated content using the Google-compatible interactions endpoint.
   * POST /v3/compat/v1beta/interactions (SSE)
   */
  async *streamGenerateContent(
    body: InteractionsRequest,
    options?: RequestOptions,
  ): AsyncGenerator<InteractionsResponse, void, undefined> {
    const streamBody: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
      stream: true,
    };
    yield* this.stream<InteractionsResponse>(INTERACTIONS_PATH, streamBody, options);
  }
}
