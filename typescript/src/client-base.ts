// =============================================================================
// Base HTTP Client for Task API SDK
// =============================================================================

import { ApiError, ErrorResponse } from './types.js';

/** Configuration options for the BaseClient */
export interface ClientConfig {
  /** API key for authentication (passed as Bearer token) */
  apiKey: string;
  /** Base URL for the API (default: https://api.opper.ai) */
  baseUrl?: string;
  /** Additional headers to include in every request */
  headers?: Record<string, string>;
}

/** Options for individual requests */
export interface RequestOptions {
  /** Additional headers for this request */
  headers?: Record<string, string>;
  /** Query parameters */
  query?: Record<string, string | number | boolean | undefined>;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
}

/** A parsed SSE event */
export interface SSEEvent {
  /** Event data (parsed line after "data: ") */
  data: string;
  /** Event type (parsed line after "event: "), if present */
  event?: string;
}

/**
 * Base HTTP client providing common functionality for all API clients.
 * Handles authentication, request construction, error handling, and SSE streaming.
 */
export class BaseClient {
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly defaultHeaders: Record<string, string>;

  constructor(config: ClientConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.opper.ai').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      ...config.headers,
    };
  }

  // ---------------------------------------------------------------------------
  // Query parameter serialization
  // ---------------------------------------------------------------------------

  /**
   * Serialize a record of query parameters into a URL query string.
   * Undefined values are omitted.
   */
  protected buildQueryString(params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) return '';
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  // ---------------------------------------------------------------------------
  // Core request method
  // ---------------------------------------------------------------------------

  /**
   * Execute an HTTP request and return the parsed JSON response.
   *
   * @throws {ApiError} if the response status is not OK
   */
  protected async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const queryString = this.buildQueryString(options?.query);
    const url = `${this.baseUrl}${path}${queryString}`;

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options?.headers,
    };

    // Remove Content-Type for requests without body
    if (body === undefined) {
      // Keep Content-Type only when there is a body
      // Some servers are fine with it, but cleaner to omit
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: options?.signal,
    };

    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorBody = await this.safeParseJson(response);
      throw new ApiError(response.status, response.statusText, errorBody);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  // ---------------------------------------------------------------------------
  // HTTP method shortcuts
  // ---------------------------------------------------------------------------

  /** Execute a GET request */
  protected async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /** Execute a POST request */
  protected async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /** Execute a PUT request */
  protected async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  /** Execute a DELETE request */
  protected async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  // ---------------------------------------------------------------------------
  // SSE Streaming support
  // ---------------------------------------------------------------------------

  /**
   * Execute an HTTP request and return an async iterable of SSE events.
   * Useful for endpoints that support streaming via Server-Sent Events.
   *
   * @throws {ApiError} if the response status is not OK
   */
  protected async *stream(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): AsyncGenerator<SSEEvent, void, undefined> {
    const queryString = this.buildQueryString(options?.query);
    const url = `${this.baseUrl}${path}${queryString}`;

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      'Accept': 'text/event-stream',
      ...options?.headers,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: options?.signal,
    };

    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorBody = await this.safeParseJson(response);
      throw new ApiError(response.status, response.statusText, errorBody);
    }

    if (!response.body) {
      return;
    }

    yield* this.parseSSEStream(response.body);
  }

  /**
   * Parse a ReadableStream into SSE events.
   */
  private async *parseSSEStream(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<SSEEvent, void, undefined> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining data in the buffer
          if (buffer.trim().length > 0) {
            const event = this.parseSSEBlock(buffer);
            if (event) {
              yield event;
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines
        const parts = buffer.split('\n\n');

        // Keep the last part in the buffer (it may be incomplete)
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length === 0) continue;

          const event = this.parseSSEBlock(trimmed);
          if (event) {
            yield event;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse a single SSE block (lines between double newlines) into an SSEEvent.
   */
  private parseSSEBlock(block: string): SSEEvent | null {
    const lines = block.split('\n');
    let data = '';
    let event: string | undefined;
    let hasData = false;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        data += (hasData ? '\n' : '') + line.slice(6);
        hasData = true;
      } else if (line.startsWith('data:')) {
        data += (hasData ? '\n' : '') + line.slice(5);
        hasData = true;
      } else if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('event:')) {
        event = line.slice(6);
      }
      // Ignore "id:" and "retry:" lines, as well as comments (lines starting with ":")
    }

    if (!hasData) return null;

    return { data, event };
  }

  // ---------------------------------------------------------------------------
  // JSON parsing utilities
  // ---------------------------------------------------------------------------

  /**
   * Safely parse the response body as JSON.
   * Returns the parsed object, or the raw text if JSON parsing fails.
   */
  protected async safeParseJson(response: Response): Promise<unknown> {
    try {
      const text = await response.text();
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse a JSON string, returning the typed result.
   * Throws a SyntaxError if the string is not valid JSON.
   */
  protected parseJson<T>(text: string): T {
    return JSON.parse(text) as T;
  }

  /**
   * Parse the data field of an SSE event as JSON.
   * Returns null if the data is the SSE termination signal "[DONE]".
   */
  protected parseSSEData<T>(data: string): T | null {
    const trimmed = data.trim();
    if (trimmed === '[DONE]') {
      return null;
    }
    return JSON.parse(trimmed) as T;
  }
}

