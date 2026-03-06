// =============================================================================
// Task API SDK - Functions Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import {
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  RealtimeCreateResponse,
  RevisionInfo,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
  RequestOptions,
} from '../types.js';

// ---------------------------------------------------------------------------
// Request / Response types specific to the functions client
// ---------------------------------------------------------------------------

/** Request body for creating a realtime function. */
export interface CreateRealtimeFunctionRequest {
  readonly instructions: string;
  readonly model?: string;
  readonly provider?: string;
  readonly voice?: string;
  readonly tools?: ReadonlyArray<{
    readonly name: string;
    readonly description?: string;
    readonly parameters: Record<string, unknown>;
  }>;
}

/** Response wrapper for listing functions. */
export interface ListFunctionsResponse {
  readonly functions: FunctionInfo[];
}

/** Response wrapper for listing revisions. */
export interface ListRevisionsResponse {
  readonly revisions: RevisionInfo[];
}

// ---------------------------------------------------------------------------
// Functions Client
// ---------------------------------------------------------------------------

/**
 * Client for the Functions API endpoints.
 * Provides methods to manage functions, revisions, and execute functions.
 */
export class FunctionsClient extends BaseClient {
  /**
   * List all cached functions for the authenticated project.
   * GET /v3/functions
   */
  async listFunctions(options?: RequestOptions): Promise<ListFunctionsResponse> {
    return this.get<ListFunctionsResponse>('/v3/functions', undefined, options);
  }

  /**
   * Get details of a specific function including its script source.
   * GET /v3/functions/{name}
   *
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
   * PUT /v3/functions/{name}
   *
   * @param name - Function name
   * @param body - Update request containing the new source code
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
   * DELETE /v3/functions/{name}
   *
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
   * POST /v3/functions/{name}/realtime
   *
   * @param name - Function name
   * @param body - Realtime function creation request
   */
  async createRealtimeFunction(
    name: string,
    body: CreateRealtimeFunctionRequest,
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
   * GET /v3/functions/{name}/revisions
   *
   * @param name - Function name
   */
  async listRevisions(
    name: string,
    options?: RequestOptions,
  ): Promise<ListRevisionsResponse> {
    return this.get<ListRevisionsResponse>(
      `/v3/functions/${encodeURIComponent(name)}/revisions`,
      undefined,
      options,
    );
  }

  /**
   * Get a specific revision of a function.
   * GET /v3/functions/{name}/revisions/{revisionID}
   *
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
   * POST /v3/functions/{name}/revisions/{revisionID}/revert
   *
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
   * POST /v3/functions/{name}/run
   *
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
   * POST /v3/functions/{name}/stream
   *
   * Returns an async generator that yields parsed SSE data events.
   *
   * @param name - Function name
   * @param body - Run request containing input, schemas, and optional hints
   */
  async *streamFunction(
    name: string,
    body: RunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<RunResponse, void, undefined> {
    yield* this.stream<RunResponse>(
      `/v3/functions/${encodeURIComponent(name)}/stream`,
      body,
      options,
    );
  }

  /**
   * Get the WebSocket URL for realtime voice agent communication.
   * GET /v3/realtime/{name}
   *
   * This endpoint requires a WebSocket upgrade. This method returns
   * the fully-qualified WebSocket URL that can be used with a WebSocket
   * client to establish a connection.
   *
   * @param name - Function name
   * @returns The WebSocket URL for the realtime endpoint
   */
  getRealtimeWebSocketUrl(name: string): string {
    const httpUrl = `${this.baseUrl}/v3/realtime/${encodeURIComponent(name)}`;
    return httpUrl.replace(/^http/, 'ws');
  }
}

