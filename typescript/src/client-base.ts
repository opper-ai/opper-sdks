// =============================================================================
// Task API SDK - Base HTTP Client
// =============================================================================

import { ApiError } from './types.js';

/**
 * Configuration options for the BaseClient.
 */
export interface ClientConfig {
  /** API key for Bearer token authentication */
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
  readonly queryParams?: Record<string, string | number | boolean | undefined>;
  /** Additional headers for this specific request */
  readonly headers?: Record<string, string>;
  /** AbortSignal for request cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Base HTTP client class with Bearer token authentication, error handling,
 * JSON serialization/deserialization, and SSE streaming support.
 *
 * All tag-specific clients extend this class.
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
   * Serialize query parameters into a URL query string.
   * Undefined values are omitted.
   */
  protected buildQueryString(
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    if (!params) {
      return '';
    }
    const entries: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        entries.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
        );
      }
    }
    return entries.length > 0 ? `?${entries.join('&')}` : '';
  }

  /**
   * Build the full URL for a request, including query parameters.
   */
  protected buildUrl(path: string, options?: RequestOptions): string {
    const queryString = this.buildQueryString(options?.queryParams);
    return `${this.baseUrl}${path}${queryString}`;
  }

  /**
   * Merge default headers with request-specific headers.
   */
  protected mergeHeaders(options?: RequestOptions): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...options?.headers,
    };
  }

  /**
   * Handle the response from a fetch call.
   * Throws ApiError for non-2xx responses.
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

    // Return text as fallback
    return (await response.text()) as T;
  }

  /**
   * Perform a GET request.
   */
  protected async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options);
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
  protected async post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options);
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
  protected async put<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options);
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
  protected async delete<T>(
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.mergeHeaders(options),
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Perform a POST request that returns a Server-Sent Events (SSE) stream.
   * Returns an async iterable of parsed SSE event data strings.
   */
  protected async *stream(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): AsyncGenerator<string, void, undefined> {
    const url = this.buildUrl(path, options);
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
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and comments
          if (trimmed === '' || trimmed.startsWith(':')) {
            continue;
          }

          // Parse SSE data lines
          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();

            // SSE stream termination signal
            if (data === '[DONE]') {
              return;
            }

            yield data;
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim() !== '') {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();
          if (data !== '[DONE]') {
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

