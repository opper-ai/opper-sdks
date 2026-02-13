import { BaseClient } from '../client-base.js';
import type {
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  RunRequest,
  RunResponse,
  UpdateFunctionRequest,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  RevisionInfo,
} from '../types.js';

/** Response wrapper for listing functions */
export interface ListFunctionsResponse {
  readonly functions: FunctionInfo[];
}

/** Response wrapper for listing revisions */
export interface ListRevisionsResponse {
  readonly revisions: RevisionInfo[];
}

/**
 * Client for managing functions, revisions, and realtime endpoints.
 * Covers all /v3/functions/* and /v3/realtime/* endpoints.
 */
export class FunctionsClient extends BaseClient {
  /**
   * List all cached functions for the authenticated project.
   * @returns A list of functions
   */
  async listFunctions(): Promise<ListFunctionsResponse> {
    return this.get<ListFunctionsResponse>('/v3/functions');
  }

  /**
   * Get details of a specific function including its script source.
   * @param name - Function name
   * @returns Function details including source and schemas
   */
  async getFunction(name: string): Promise<FunctionDetails> {
    return this.get<FunctionDetails>(`/v3/functions/${encodeURIComponent(name)}`);
  }

  /**
   * Update the source code of a function.
   * @param name - Function name
   * @param body - Update request containing the new source
   * @returns Updated function details
   */
  async updateFunction(name: string, body: UpdateFunctionRequest): Promise<FunctionDetails> {
    return this.put<FunctionDetails>(`/v3/functions/${encodeURIComponent(name)}`, body);
  }

  /**
   * Delete a cached function.
   * @param name - Function name
   */
  async deleteFunction(name: string): Promise<void> {
    return this.delete<void>(`/v3/functions/${encodeURIComponent(name)}`);
  }

  /**
   * Generate a realtime voice agent function.
   * @param name - Function name
   * @param body - Realtime function creation request
   * @returns Realtime function creation response
   */
  async createRealtimeFunction(name: string, body: RealtimeCreateRequest): Promise<RealtimeCreateResponse> {
    return this.post<RealtimeCreateResponse>(`/v3/functions/${encodeURIComponent(name)}/realtime`, body);
  }

  /**
   * List all revisions of a function.
   * @param name - Function name
   * @returns A list of revisions
   */
  async listRevisions(name: string): Promise<ListRevisionsResponse> {
    return this.get<ListRevisionsResponse>(`/v3/functions/${encodeURIComponent(name)}/revisions`);
  }

  /**
   * Get a specific revision of a function.
   * @param name - Function name
   * @param revisionID - Revision ID
   * @returns Revision details including source and schemas
   */
  async getRevision(name: string, revisionID: number): Promise<FunctionRevision> {
    return this.get<FunctionRevision>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}`
    );
  }

  /**
   * Revert a function to a previous revision.
   * @param name - Function name
   * @param revisionID - Revision ID to revert to
   * @returns Updated function details after revert
   */
  async revertRevision(name: string, revisionID: number): Promise<FunctionDetails> {
    return this.post<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}/revert`,
      {}
    );
  }

  /**
   * Execute a function with the given input. If no cached script exists, one is generated automatically.
   * @param name - Function name
   * @param body - Run request with input, schemas, and optional hints/tools
   * @returns Run response with output and metadata
   */
  async runFunction(name: string, body: RunRequest): Promise<RunResponse> {
    return this.post<RunResponse>(`/v3/functions/${encodeURIComponent(name)}/run`, body);
  }

  /**
   * Execute a function with SSE streaming output.
   * Returns an async iterable of server-sent events.
   * @param name - Function name
   * @param body - Run request with input, schemas, and optional hints/tools
   * @returns An async iterable of SSE event strings
   */
  async streamFunction(name: string, body: RunRequest): Promise<AsyncIterable<string>> {
    return this.stream(`/v3/functions/${encodeURIComponent(name)}/stream`, body);
  }

  /**
   * Get the WebSocket URL for realtime voice agent communication.
   * The caller is responsible for establishing the WebSocket connection.
   * @param name - Function name
   * @returns The fully qualified WebSocket URL
   */
  realtimeWebSocketUrl(name: string): string {
    const base = this.baseUrl;
    const wsUrl = base.replace(/^http/, 'ws');
    return `${wsUrl}/v3/realtime/${encodeURIComponent(name)}`;
  }
}

