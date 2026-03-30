// =============================================================================
// Task API SDK - Base HTTP Client
// =============================================================================

import {
  ApiError,
  AuthenticationError,
  BadRequestError,
  type ClientConfig,
  InternalServerError,
  NotFoundError,
  RateLimitError,
  type RequestOptions,
} from "./types.js";

/** Default base URL for the Task API. */
const DEFAULT_BASE_URL = "https://api.opper.ai";

/**
 * Base HTTP client with configurable baseUrl and API key (Bearer auth).
 * Provides methods for GET, POST, PUT, DELETE requests with JSON serialization,
 * error handling, and SSE streaming support.
 */
export class BaseClient {
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly defaultHeaders: Record<string, string>;

  constructor(config: ClientConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? "";
    this.defaultHeaders = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...config.headers,
    };
  }

  // ---------------------------------------------------------------------------
  // Query parameter serialization
  // ---------------------------------------------------------------------------

  /**
   * Serialize a record of query parameters into a URL query string.
   * Undefined and null values are omitted.
   */
  protected buildQueryString(
    params?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    if (!params) return "";
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }

  // ---------------------------------------------------------------------------
  // Core request helpers
  // ---------------------------------------------------------------------------

  /**
   * Build merged headers for a request, combining defaults with per-request overrides.
   */
  private mergeHeaders(options?: RequestOptions): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...options?.headers,
    };
  }

  /**
   * Perform a fetch request and handle errors.
   * Returns the raw Response object.
   */
  protected async fetchRaw(
    url: string,
    init: RequestInit,
    options?: RequestOptions,
  ): Promise<Response> {
    const headers = this.mergeHeaders(options);
    const response = await fetch(url, {
      ...init,
      headers,
      signal: options?.signal,
    });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        try {
          body = await response.text();
        } catch {
          body = undefined;
        }
      }

      const st = response.statusText;
      switch (response.status) {
        case 400:
          throw new BadRequestError(st, body);
        case 401:
          throw new AuthenticationError(st, body);
        case 404:
          throw new NotFoundError(st, body);
        case 429:
          throw new RateLimitError(st, body);
        case 500:
          throw new InternalServerError(st, body);
        default:
          throw new ApiError(response.status, st, body);
      }
    }

    return response;
  }

  /**
   * Perform a request and parse the JSON response body.
   */
  protected async request<T>(
    method: string,
    path: string,
    options?: RequestOptions & {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined | null>;
    },
  ): Promise<T> {
    const queryString = this.buildQueryString(options?.query);
    const url = `${this.baseUrl}${path}${queryString}`;

    const init: RequestInit = {
      method,
    };

    if (options?.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await this.fetchRaw(url, init, options);

    // Handle 204 No Content or empty bodies
    const contentLength = response.headers.get("content-length");
    if (response.status === 204 || contentLength === "0") {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  // ---------------------------------------------------------------------------
  // HTTP method shortcuts
  // ---------------------------------------------------------------------------

  /** Perform a GET request. */
  protected async get<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("GET", path, { ...options, query });
  }

  /** Perform a POST request. */
  protected async post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions & {
      query?: Record<string, string | number | boolean | undefined | null>;
    },
  ): Promise<T> {
    return this.request<T>("POST", path, { ...options, body });
  }

  /** Perform a PUT request. */
  protected async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("PUT", path, { ...options, body });
  }

  /** Perform a PATCH request. */
  protected async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, { ...options, body });
  }

  /** Perform a DELETE request. */
  protected async delete<T>(
    path: string,
    options?: RequestOptions & {
      query?: Record<string, string | number | boolean | undefined | null>;
    },
  ): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  // ---------------------------------------------------------------------------
  // SSE Streaming support
  // ---------------------------------------------------------------------------

  /**
   * Perform a POST request that returns a Server-Sent Events (SSE) stream.
   * Yields parsed data objects of type T for each SSE "data:" line.
   * The stream ends when a "data: [DONE]" message is received or the
   * response body is exhausted.
   */
  protected async *stream<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions & {
      query?: Record<string, string | number | boolean | undefined | null>;
    },
  ): AsyncGenerator<T, void, undefined> {
    const queryString = this.buildQueryString(options?.query);
    const url = `${this.baseUrl}${path}${queryString}`;

    const headers = {
      ...this.defaultHeaders,
      Accept: "text/event-stream",
      ...options?.headers,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        try {
          errorBody = await response.text();
        } catch {
          errorBody = undefined;
        }
      }
      throw new ApiError(response.status, response.statusText, errorBody);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let currentEvent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from the buffer
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines (also resets event type per SSE spec) and comments
          if (!trimmed) {
            currentEvent = "";
            continue;
          }
          if (trimmed.startsWith(":")) {
            continue;
          }

          // Track SSE event type (e.g. "event: complete")
          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }

          // Process "data:" lines
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();

            // Check for stream termination signal
            if (data === "[DONE]") {
              return;
            }

            // Skip empty data
            if (!data) {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              // "event: complete" carries the final {data, meta} response
              if (currentEvent === "complete") {
                yield { type: "complete", ...parsed } as T;
              } else {
                yield parsed as T;
              }
            } catch {}

            currentEvent = "";
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();
          if (data && data !== "[DONE]") {
            try {
              yield JSON.parse(data) as T;
            } catch {
              // Ignore parse errors for trailing data
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
