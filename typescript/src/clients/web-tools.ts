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
 */
export class WebToolsClient extends BaseClient {
  /**
   * Fetch a URL and return its content as markdown.
   * POST /v3/tools/web/fetch
   */
  async fetch(body: WebFetchRequest, options?: RequestOptions): Promise<WebFetchResponse> {
    return this.post<WebFetchResponse>("/v3/beta/tools/web/fetch", body, options);
  }

  /**
   * Search the web and return results with title, URL, and snippet.
   * POST /v3/beta/tools/web/search
   */
  async search(body: WebSearchRequest, options?: RequestOptions): Promise<WebSearchResponse> {
    return this.post<WebSearchResponse>("/v3/beta/tools/web/search", body, options);
  }
}
