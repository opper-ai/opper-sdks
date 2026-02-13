import { ApiError } from './types.js';
import type { ErrorResponse } from './types.js';

/**
 * Configuration options for the base HTTP client.
 */
export interface ClientConfig {
  /** API key for Bearer authentication */
  readonly apiKey: string;
  /** Base URL for the API (default: https://api.opper.ai) */
  readonly baseUrl?: string;
  /** Additional headers to include in every request */
  readonly headers?: Record<string, string>;
}

/**
 * Options for making HTTP requests.
 */
export interface RequestOptions {
  /** Query parameters to append to the URL */
  readonly query?: Record<string, string | number | boolean | undefined>;
  /** Additional headers for this specific request */
  readonly headers?: Record<string, string>;
  /** AbortSignal for request cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Base HTTP client class providing authenticated request methods,
 * error handling, and SSE streaming support.
 *
 * Supports both production (https://api.opper.ai) and local dev
 * (http://localhost:8080) servers.
 */
export class BaseClient {
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly defaultHeaders: Record<string, string>;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.opper.ai').replace(/\/+$/, '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...config.headers,
    };
  }

  /**
   * Build a full URL with path and optional query parameters.
   */
  protected buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
    }
    return url.toString();
  }

  /**
   * Merge default headers with per-request headers.
   */
  protected mergeHeaders(options?: RequestOptions): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...options?.headers,
    };
  }

  /**
   * Handle the response from a fetch call.
   * Throws an ApiError for non-OK responses.
   */
  protected async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => null);
      }
      throw new ApiError(response.status, response.statusText, body);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as T;
  }

  /**
   * Perform a GET request.
   */
  protected async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.mergeHeaders(options),
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Perform a POST request with a JSON body.
   */
  protected async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.mergeHeaders(options),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Perform a PUT request with a JSON body.
   */
  protected async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.mergeHeaders(options),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Perform a DELETE request.
   */
  protected async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.mergeHeaders(options),
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Perform a POST request that returns a Server-Sent Events (SSE) stream.
   * Yields parsed SSE data events as strings.
   */
  protected async *stream(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): AsyncGenerator<string, void, undefined> {
    const url = this.buildUrl(path, options?.query);
    const headers = {
      ...this.mergeHeaders(options),
      'Accept': 'text/event-stream',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }
      throw new ApiError(response.status, response.statusText, errorBody);
    }

    if (!response.body) {
      throw new ApiError(0, 'No response body', 'Response body is null for SSE stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '') {
            continue;
          }
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              return;
            }
            yield data;
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data !== '[DONE]') {
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Perform a POST request that returns a typed SSE stream.
   * Yields parsed JSON objects from SSE data events.
   */
  protected async *streamJson<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): AsyncGenerator<T, void, undefined> {
    for await (const data of this.stream(path, body, options)) {
      try {
        yield JSON.parse(data) as T;
      } catch {
        // Skip non-JSON data events
      }
    }
  }
}

