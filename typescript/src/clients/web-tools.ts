import { BaseClient } from "../client-base.js";
import type {
  RequestOptions,
  WebFetchRequest,
  WebFetchResponse,
  WebSearchRequest,
  WebSearchResponse,
} from "../types.js";

/**
 * Client for the Web Tools API endpoints.
 * Provides methods to fetch URLs and search the web.
 *
 * @beta These endpoints are marked `x-beta: true` in the OpenAPI spec.
 * Behavior and request/response shapes may change without a major version bump.
 * Exposed under `opper.beta.web` to reinforce this status.
 */
export class WebToolsClient extends BaseClient {
  /**
   * Fetch a URL and return its content as markdown.
   *
   * @beta
   */
  async fetch(body: WebFetchRequest, options?: RequestOptions): Promise<WebFetchResponse> {
    return this._post<WebFetchResponse>("/v3/tools/web/fetch", body, options);
  }

  /**
   * Search the web and return results with title, URL, and snippet.
   *
   * @beta
   */
  async search(body: WebSearchRequest, options?: RequestOptions): Promise<WebSearchResponse> {
    return this._post<WebSearchResponse>("/v3/tools/web/search", body, options);
  }
}
