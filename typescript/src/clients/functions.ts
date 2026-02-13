// =============================================================================
// Task API SDK - Functions Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type {
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  RequestOptions,
  RevisionInfo,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
} from '../types.js';

// -----------------------------------------------------------------------------
// Response wrapper interfaces for list endpoints
// -----------------------------------------------------------------------------

/** Response from listing functions. */
export interface ListFunctionsResponse {
  readonly functions: FunctionInfo[];
}

/** Response from listing revisions. */
export interface ListRevisionsResponse {
  readonly revisions: RevisionInfo[];
}

// -----------------------------------------------------------------------------
// FunctionsClient
// -----------------------------------------------------------------------------

/**
 * Client for managing Task API functions.
 * Provides methods for CRUD operations, revisions, execution, streaming,
 * realtime function creation, and WebSocket connections.
 */
export class FunctionsClient extends BaseClient {
  /**
   * List all cached functions for the authenticated project.
   */
  async listFunctions(options?: RequestOptions): Promise<ListFunctionsResponse> {
    return this.get<ListFunctionsResponse>('/v3/functions', undefined, options);
  }

  /**
   * Get details of a specific function including its script source.
   * @param name - Function name
   */
  async getFunction(name: string, options?: RequestOptions): Promise<FunctionDetails> {
    return this.get<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}`,
      undefined,
      options,
    );
  }

  /**
   * Update the source code of a function.
   * @param name - Function name
   * @param body - Update request containing the new source
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
   * @param name - Function name
   */
  async deleteFunction(name: string, options?: RequestOptions): Promise<void> {
    return this.delete<void>(
      `/v3/functions/${encodeURIComponent(name)}`,
      options,
    );
  }

  /**
   * Generate a realtime voice agent function.
   * @param name - Function name
   * @param body - Realtime function creation request
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
   * @param name - Function name
   */
  async listRevisions(name: string, options?: RequestOptions): Promise<ListRevisionsResponse> {
    return this.get<ListRevisionsResponse>(
      `/v3/functions/${encodeURIComponent(name)}/revisions`,
      undefined,
      options,
    );
  }

  /**
   * Get a specific revision of a function.
   * @param name - Function name
   * @param revisionID - Revision ID
   */
  async getRevision(
    name: string,
    revisionID: number,
    options?: RequestOptions,
  ): Promise<FunctionRevision> {
    return this.get<FunctionRevision>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}`,
      undefined,
      options,
    );
  }

  /**
   * Revert a function to a previous revision.
   * @param name - Function name
   * @param revisionID - Revision ID to revert to
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
   * @param name - Function name
   * @param body - Run request containing input, schemas, and optional hints
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
   * Yields parsed data objects for each SSE event.
   * The stream ends when a "[DONE]" sentinel is received.
   * @param name - Function name
   * @param body - Run request containing input, schemas, and optional hints
   */
  streamFunction(
    name: string,
    body: RunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<RunResponse, void, undefined> {
    return this.stream<RunResponse>(
      `/v3/functions/${encodeURIComponent(name)}/stream`,
      body,
      options,
    );
  }

  /**
   * Build a WebSocket URL for realtime voice agent communication.
   * The caller is responsible for creating the WebSocket connection
   * using the returned URL.
   * @param name - Function name
   * @returns The WebSocket URL for the realtime endpoint
   */
  realtimeWebSocket(name: string): string {
    const base = this.baseUrl.replace(/^http/, 'ws');
    return `${base}/v3/realtime/${encodeURIComponent(name)}`;
  }
}

