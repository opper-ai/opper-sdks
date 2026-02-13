// =============================================================================
// Functions Client for Task API SDK
// =============================================================================

import { BaseClient, type RequestOptions, type SSEEvent } from '../client-base.js';
import type {
  FunctionDetails,
  FunctionRevision,
  ListFunctionsResponse,
  ListRevisionsResponse,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
} from '../types.js';

/**
 * Client for the Functions API endpoints.
 *
 * Provides methods for managing cached functions, revisions, running functions,
 * streaming function output, and realtime voice agent communication.
 */
export class FunctionsClient extends BaseClient {
  // ---------------------------------------------------------------------------
  // Function CRUD
  // ---------------------------------------------------------------------------

  /**
   * List all cached functions for the authenticated project.
   *
   * @param options - Optional request options (headers, signal, etc.)
   * @returns A list of function summaries
   */
  async listFunctions(options?: RequestOptions): Promise<ListFunctionsResponse> {
    return this.get<ListFunctionsResponse>('/v3/functions', options);
  }

  /**
   * Get details of a specific function including its script source.
   *
   * @param name - Function name
   * @param options - Optional request options
   * @returns Detailed function information
   */
  async getFunction(name: string, options?: RequestOptions): Promise<FunctionDetails> {
    return this.get<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}`,
      options,
    );
  }

  /**
   * Update the source code of a function.
   *
   * @param name - Function name
   * @param body - The update request containing the new source code
   * @param options - Optional request options
   * @returns Updated function details
   */
  async updateFunction(
    name: string,
    body: UpdateFunctionRequest,
    options?: RequestOptions,
  ): Promise<FunctionDetails> {
    return this.put<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}`,
      body,
      options,
    );
  }

  /**
   * Delete a cached function.
   *
   * @param name - Function name
   * @param options - Optional request options
   */
  async deleteFunction(name: string, options?: RequestOptions): Promise<void> {
    return this.delete<void>(
      `/v3/functions/${encodeURIComponent(name)}`,
      options,
    );
  }

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------

  /**
   * Generate a realtime voice agent function.
   *
   * @param name - Function name
   * @param body - Realtime function creation parameters
   * @param options - Optional request options
   * @returns The created realtime function details
   */
  async createRealtimeFunction(
    name: string,
    body: RealtimeCreateRequest,
    options?: RequestOptions,
  ): Promise<RealtimeCreateResponse> {
    return this.post<RealtimeCreateResponse>(
      `/v3/functions/${encodeURIComponent(name)}/realtime`,
      body,
      options,
    );
  }

  /**
   * Get the WebSocket URL for realtime voice agent communication.
   *
   * Note: This method returns the URL for establishing a WebSocket connection.
   * The actual WebSocket connection must be created by the caller using the
   * returned URL. The server expects an HTTP Upgrade request and responds
   * with 101 Switching Protocols on success.
   *
   * @param name - Function name
   * @returns The WebSocket URL string
   */
  realtimeWebSocket(name: string): string {
    const baseWsUrl = this.baseUrl
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:');
    return `${baseWsUrl}/v3/realtime/${encodeURIComponent(name)}`;
  }

  // ---------------------------------------------------------------------------
  // Revisions
  // ---------------------------------------------------------------------------

  /**
   * List all revisions of a function.
   *
   * @param name - Function name
   * @param options - Optional request options
   * @returns A list of revision summaries
   */
  async listRevisions(name: string, options?: RequestOptions): Promise<ListRevisionsResponse> {
    return this.get<ListRevisionsResponse>(
      `/v3/functions/${encodeURIComponent(name)}/revisions`,
      options,
    );
  }

  /**
   * Get a specific revision of a function.
   *
   * @param name - Function name
   * @param revisionID - Revision ID
   * @param options - Optional request options
   * @returns The full revision details
   */
  async getRevision(
    name: string,
    revisionID: number,
    options?: RequestOptions,
  ): Promise<FunctionRevision> {
    return this.get<FunctionRevision>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}`,
      options,
    );
  }

  /**
   * Revert a function to a previous revision.
   *
   * @param name - Function name
   * @param revisionID - Revision ID to revert to
   * @param options - Optional request options
   * @returns The function details after reversion
   */
  async revertRevision(
    name: string,
    revisionID: number,
    options?: RequestOptions,
  ): Promise<FunctionDetails> {
    return this.post<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}/revert`,
      undefined,
      options,
    );
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a function with the given input.
   * If no cached script exists, one is generated automatically.
   *
   * @param name - Function name
   * @param body - The run request containing input and schemas
   * @param options - Optional request options
   * @returns The function execution result
   */
  async runFunction(
    name: string,
    body: RunRequest,
    options?: RequestOptions,
  ): Promise<RunResponse> {
    return this.post<RunResponse>(
      `/v3/functions/${encodeURIComponent(name)}/run`,
      body,
      options,
    );
  }

  /**
   * Execute a function with SSE streaming output.
   *
   * Returns an async generator that yields SSE events. Each event's `data`
   * field contains a JSON string. The stream terminates with a `[DONE]` sentinel.
   *
   * @param name - Function name
   * @param body - The run request containing input and schemas
   * @param options - Optional request options
   * @returns An async generator of SSE events
   */
  async *streamFunction(
    name: string,
    body: RunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<SSEEvent, void, undefined> {
    yield* this.stream(
      'POST',
      `/v3/functions/${encodeURIComponent(name)}/stream`,
      body,
      options,
    );
  }
}

