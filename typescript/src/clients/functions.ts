// =============================================================================
// Task API SDK - Functions Client
// =============================================================================

import { BaseClient } from '../client-base.js';
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
 * Provides methods to manage cached functions, their revisions,
 * execute functions, stream function output, and create realtime
 * voice agent functions.
 */
export class FunctionsClient extends BaseClient {
  /**
   * List all cached functions for the authenticated project.
   *
   * @returns A list of function summaries.
   */
  async listFunctions(): Promise<ListFunctionsResponse> {
    return this.get<ListFunctionsResponse>('/v3/functions');
  }

  /**
   * Get details of a specific function including its script source.
   *
   * @param name - Function name.
   * @returns Detailed function information including source and schemas.
   */
  async getFunction(name: string): Promise<FunctionDetails> {
    return this.get<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}`,
    );
  }

  /**
   * Update the source code of a function.
   *
   * @param name - Function name.
   * @param body - The update request containing the new source code.
   * @returns Updated function details.
   */
  async updateFunction(
    name: string,
    body: UpdateFunctionRequest,
  ): Promise<FunctionDetails> {
    return this.put<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}`,
      body,
    );
  }

  /**
   * Delete a cached function.
   *
   * @param name - Function name.
   */
  async deleteFunction(name: string): Promise<void> {
    return this.delete<void>(
      `/v3/functions/${encodeURIComponent(name)}`,
    );
  }

  /**
   * Generate a realtime voice agent function.
   *
   * @param name - Function name.
   * @param body - The realtime function creation request.
   * @returns The created realtime function details.
   */
  async createRealtimeFunction(
    name: string,
    body: RealtimeCreateRequest,
  ): Promise<RealtimeCreateResponse> {
    return this.post<RealtimeCreateResponse>(
      `/v3/functions/${encodeURIComponent(name)}/realtime`,
      body,
    );
  }

  /**
   * List all revisions of a function.
   *
   * @param name - Function name.
   * @returns A list of revision summaries.
   */
  async listRevisions(name: string): Promise<ListRevisionsResponse> {
    return this.get<ListRevisionsResponse>(
      `/v3/functions/${encodeURIComponent(name)}/revisions`,
    );
  }

  /**
   * Get a specific revision of a function.
   *
   * @param name - Function name.
   * @param revisionID - Revision ID.
   * @returns The function revision details including source and schemas.
   */
  async getRevision(
    name: string,
    revisionID: number,
  ): Promise<FunctionRevision> {
    return this.get<FunctionRevision>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}`,
    );
  }

  /**
   * Revert a function to a previous revision.
   *
   * @param name - Function name.
   * @param revisionID - Revision ID to revert to.
   * @returns The updated function details after revert.
   */
  async revertRevision(
    name: string,
    revisionID: number,
  ): Promise<FunctionDetails> {
    return this.post<FunctionDetails>(
      `/v3/functions/${encodeURIComponent(name)}/revisions/${encodeURIComponent(String(revisionID))}/revert`,
    );
  }

  /**
   * Execute a function with the given input.
   * If no cached script exists, one is generated automatically.
   *
   * @param name - Function name.
   * @param body - The run request containing input, schemas, and optional hints.
   * @returns The function output and execution metadata.
   */
  async runFunction(
    name: string,
    body: RunRequest,
  ): Promise<RunResponse> {
    return this.post<RunResponse>(
      `/v3/functions/${encodeURIComponent(name)}/run`,
      body,
    );
  }

  /**
   * Execute a function with SSE streaming output.
   * Returns an async generator that yields SSE event data strings.
   *
   * Each yielded string is the raw data payload of an SSE event.
   * Parse it as JSON to get structured data.
   *
   * @param name - Function name.
   * @param body - The run request containing input, schemas, and optional hints.
   * @returns An async generator of SSE event data strings.
   */
  async *streamFunction(
    name: string,
    body: RunRequest,
  ): AsyncGenerator<string, void, undefined> {
    yield* this.stream(
      `/v3/functions/${encodeURIComponent(name)}/stream`,
      body,
    );
  }

  /**
   * Get the WebSocket URL for realtime voice agent communication.
   *
   * Since WebSocket connections require a protocol upgrade that cannot be
   * performed via the standard fetch API, this method returns the fully
   * qualified WebSocket URL. Use it with the native `WebSocket` constructor
   * or a compatible WebSocket library.
   *
   * @param name - Function name.
   * @returns The WebSocket URL string (ws:// or wss://).
   */
  realtimeWebSocket(name: string): string {
    const httpUrl = `${this.baseUrl}/v3/realtime/${encodeURIComponent(name)}`;
    return httpUrl.replace(/^http/, 'ws');
  }
}

