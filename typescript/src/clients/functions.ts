import { BaseClient } from '../client-base.js';
import type { ClientConfig, RequestOptions } from '../client-base.js';
import type {
  FunctionDetails,
  FunctionInfo,
  ListFunctionsResponse,
  ListRevisionsResponse,
  FunctionRevision,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  RevisionInfo,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
} from '../types.js';

/**
 * Client for the Functions API endpoints.
 *
 * Provides methods for managing schema-driven functions including
 * CRUD operations, revision management, execution, streaming,
 * and realtime voice agent support.
 */
export class FunctionsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /**
   * List all cached functions for the authenticated project.
   *
   * @param options - Optional request options
   * @returns A list of functions
   */
  async listFunctions(options?: RequestOptions): Promise<ListFunctionsResponse> {
    return this.get<ListFunctionsResponse>('/v3/functions', options);
  }

  /**
   * Get details of a specific function including its script source.
   *
   * @param name - Function name
   * @param options - Optional request options
   * @returns The function details
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
   * @param body - The update request body containing the new source
   * @param options - Optional request options
   * @returns The updated function details
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

  /**
   * Generate a realtime voice agent function.
   *
   * @param name - Function name
   * @param body - The realtime function creation request
   * @param options - Optional request options
   * @returns The created realtime function response
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
   * List all revisions of a function.
   *
   * @param name - Function name
   * @param options - Optional request options
   * @returns A list of revisions
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
   * @returns The function revision details
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
   * @returns The reverted function details
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

  /**
   * Execute a function with the given input.
   * If no cached script exists, one is generated automatically.
   *
   * @param name - Function name
   * @param body - The run request body
   * @param options - Optional request options
   * @returns The function execution response
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
   * Yields parsed SSE data events as strings from the Server-Sent Events stream.
   *
   * @param name - Function name
   * @param body - The run request body
   * @param options - Optional request options
   * @returns An async generator yielding streamed data chunks
   */
  async *streamFunction(
    name: string,
    body: RunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<string, void, undefined> {
    yield* this.stream(
      `/v3/functions/${encodeURIComponent(name)}/stream`,
      body,
      options,
    );
  }

  /**
   * Get the WebSocket URL for realtime voice agent communication.
   *
   * The returned URL can be used to establish a WebSocket connection
   * for bidirectional realtime communication. The caller is responsible
   * for creating the WebSocket connection.
   *
   * @param name - Function name
   * @returns The full WebSocket URL for the realtime endpoint
   */
  realtimeWebSocket(name: string): string {
    const httpUrl = this.buildUrl(
      `/v3/realtime/${encodeURIComponent(name)}`,
    );
    // Convert http(s) URL to ws(s) URL
    return httpUrl.replace(/^http(s?):\/\//, 'ws$1://');
  }
}

