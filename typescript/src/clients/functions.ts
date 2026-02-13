import { BaseClient } from '../client-base.js';
import type {
  FunctionInfo,
  FunctionDetails,
  FunctionRevision,
  RunRequest,
  RunResponse,
  RealtimeCreateRequest,
  RealtimeCreateResponse,
  UpdateFunctionRequest,
  RevisionInfo,
} from '../types.js';

/** Response shape for listFunctions */
export interface ListFunctionsResponse {
  readonly functions: FunctionInfo[];
}

/** Response shape for listRevisions */
export interface ListRevisionsResponse {
  readonly revisions: RevisionInfo[];
}

/**
 * Client for the Functions API endpoints.
 * Provides methods to manage functions, revisions, and execute function runs.
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
   * @returns Function details including source code and schemas
   */
  async getFunction(name: string): Promise<FunctionDetails> {
    return this.get<FunctionDetails>(`/v3/functions/${encodeURIComponent(name)}`);
  }

  /**
   * Update the source code of a function.
   * @param name - Function name
   * @param body - The update request containing the new source
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
   * @param body - The realtime creation request
   * @returns The created realtime function details
   */
  async createRealtimeFunction(
    name: string,
    body: RealtimeCreateRequest
  ): Promise<RealtimeCreateResponse> {
    return this.post<RealtimeCreateResponse>(
      `/v3/functions/${encodeURIComponent(name)}/realtime`,
      body
    );
  }

  /**
   * List all revisions of a function.
   * @param name - Function name
   * @returns A list of revisions
   */
  async listRevisions(name: string): Promise<ListRevisionsResponse> {
    return this.get<ListRevisionsResponse>(
      `/v3/functions/${encodeURIComponent(name)}/revisions`
    );
  }

  /**
   * Get a specific revision of a function.
   * @param name - Function name
   * @param revisionID - Revision ID
   * @returns The function revision details
   */
  async getRevision(name: string, revisionID: number): Promise<FunctionRevision> {
    return this.get<FunctionRevision>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}`
    );
  }

  /**
   * Revert a function to a previous revision.
   * @param name - Function name
   * @param revisionID - Revision ID
   * @returns The reverted function details
   */
  async revertRevision(name: string, revisionID: number): Promise<FunctionDetails> {
    return this.post<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}/revert`,
      undefined
    );
  }

  /**
   * Execute a function with the given input.
   * If no cached script exists, one is generated automatically.
   * @param name - Function name
   * @param body - The run request containing input and schemas
   * @returns The function execution result
   */
  async runFunction(name: string, body: RunRequest): Promise<RunResponse> {
    return this.post<RunResponse>(
      `/v3/functions/${encodeURIComponent(name)}/run`,
      body
    );
  }

  /**
   * Execute a function with SSE streaming output.
   * Returns an async generator that yields server-sent event data strings.
   * Each yielded string is the content of one SSE "data:" line.
   * The stream ends when the server sends the '[DONE]' sentinel.
   * @param name - Function name
   * @param body - The run request containing input and schemas
   * @returns An async generator of SSE event data strings
   */
  async streamFunction(
    name: string,
    body: RunRequest
  ): Promise<AsyncGenerator<string, void, undefined>> {
    return this.stream(
      `/v3/functions/${encodeURIComponent(name)}/stream`,
      body
    );
  }

  /**
   * Get the WebSocket URL for realtime voice agent communication.
   * The caller is responsible for establishing the WebSocket connection.
   * @param name - Function name
   * @returns The fully-qualified WebSocket URL
   */
  getRealtimeWebSocketUrl(name: string): string {
    const base = this.baseUrl.replace(/^http/, 'ws');
    return `${base}/v3/realtime/${encodeURIComponent(name)}`;
  }
}

