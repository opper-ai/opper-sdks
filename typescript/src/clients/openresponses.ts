// =============================================================================
// OpenResponses Client — HTTP client for /v3/compat/openresponses
// =============================================================================

import type { ORRequest, ORResponse, ORStreamEvent } from "../agent/types.js";
import { BaseClient } from "../client-base.js";
import type { RequestOptions } from "../types.js";

const ENDPOINT = "/v3/compat/openresponses";

/**
 * Client for the OpenResponses endpoint.
 *
 * Provides two methods:
 * - `create()` — synchronous (stream: false), returns ORResponse
 * - `createStream()` — streaming (stream: true), yields ORStreamEvent
 */
export class OpenResponsesClient extends BaseClient {
  /**
   * Create a response (non-streaming).
   * Sends the request with `stream: false` and returns the complete ORResponse.
   */
  async create(request: ORRequest, options?: RequestOptions): Promise<ORResponse> {
    return this._post<ORResponse>(ENDPOINT, { ...request, stream: false }, options);
  }

  /**
   * Create a streaming response.
   * Sends the request with `stream: true` and yields ORStreamEvent objects
   * parsed from the SSE stream.
   *
   * OpenResponses SSE format uses named event types:
   * ```
   * event: response.output_text.delta
   * data: {"type":"response.output_text.delta","output_index":0,"delta":"Hello"}
   * ```
   */
  async *createStream(
    request: ORRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ORStreamEvent, void, undefined> {
    // Use fetchRaw for unified error mapping (4xx/5xx → typed subclasses).
    const response = await this.fetchRaw(
      `${this.baseUrl}${ENDPOINT}`,
      {
        method: "POST",
        body: JSON.stringify({ ...request, stream: true }),
      },
      {
        ...options,
        headers: { ...options?.headers, Accept: "text/event-stream" },
      },
    );

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          // Empty lines and comments — skip
          if (!trimmed || trimmed.startsWith(":")) {
            continue;
          }

          // event: lines — skip (type is embedded in the data JSON)
          if (trimmed.startsWith("event:")) {
            continue;
          }

          // data: lines — parse and yield
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();

            if (data === "[DONE]") {
              return;
            }

            if (!data) {
              continue;
            }

            try {
              const parsed = JSON.parse(data) as ORStreamEvent;
              yield parsed;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();
          if (data && data !== "[DONE]") {
            try {
              yield JSON.parse(data) as ORStreamEvent;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
