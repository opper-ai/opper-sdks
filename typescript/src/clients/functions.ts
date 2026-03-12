import { BaseClient } from "../client-base.js";
import type {
  FunctionDetails,
  FunctionInfo,
  FunctionRevision,
  RealtimeCreateResponse,
  RequestOptions,
  RevisionInfo,
  RunRequest,
  RunResponse,
  StreamChunk,
  UpdateFunctionRequest,
} from "../types.js";

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

/** A single example for a function. */
export interface Example {
  readonly uuid?: string;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly tag?: string;
}

/** Response wrapper for listing examples. */
export interface ListExamplesResponse {
  readonly examples: Example[];
}

/** Parameters for listing examples. */
export interface ListExamplesParams {
  readonly limit?: number;
  readonly offset?: number;
  readonly tag?: string;
}

// ---------------------------------------------------------------------------
// Functions Client
// ---------------------------------------------------------------------------

/**
 * Client for the Functions API endpoints.
 * Provides methods to manage functions, revisions, examples, and execute functions.
 */
export class FunctionsClient extends BaseClient {
  /**
   * List all cached functions for the authenticated project.
   * GET /v3/functions
   */
  async listFunctions(options?: RequestOptions): Promise<ListFunctionsResponse> {
    return this.get<ListFunctionsResponse>("/v3/functions", undefined, options);
  }

  /**
   * Get details of a specific function including its script source.
   * GET /v3/functions/{name}
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
   */
  async updateFunction(
    name: string,
    body: UpdateFunctionRequest,
    options?: RequestOptions,
  ): Promise<FunctionDetails> {
    return this.put<FunctionDetails>(`/v3/functions/${encodeURIComponent(name)}`, body, options);
  }

  /**
   * Delete a cached function.
   * DELETE /v3/functions/{name}
   */
  async deleteFunction(name: string, options?: RequestOptions): Promise<void> {
    return this.delete<void>(`/v3/functions/${encodeURIComponent(name)}`, options);
  }

  /**
   * Generate a realtime voice agent function.
   * POST /v3/functions/{name}/realtime
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
   * GET /v3/functions/{name}/revisions/{revisionID}
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
   * POST /v3/functions/{name}/run
   */
  async runFunction<T = unknown>(
    name: string,
    body: RunRequest,
    options?: RequestOptions,
  ): Promise<RunResponse<T>> {
    return this.post<RunResponse<T>>(
      `/v3/functions/${encodeURIComponent(name)}/run`,
      body,
      options,
    );
  }

  /**
   * Execute a function with SSE streaming output.
   * POST /v3/functions/{name}/stream
   *
   * Returns an async generator that yields StreamChunk events.
   */
  async *streamFunction(
    name: string,
    body: RunRequest,
    options?: RequestOptions,
  ): AsyncGenerator<StreamChunk, void, undefined> {
    yield* this.stream<StreamChunk>(
      `/v3/functions/${encodeURIComponent(name)}/stream`,
      body,
      options,
    );
  }

  /**
   * Get the WebSocket URL for realtime voice agent communication.
   */
  getRealtimeWebSocketUrl(name: string): string {
    const httpUrl = `${this.baseUrl}/v3/realtime/${encodeURIComponent(name)}`;
    return httpUrl.replace(/^http/, "ws");
  }

  // ---------------------------------------------------------------------------
  // Examples (Few-Shot Steering)
  // ---------------------------------------------------------------------------

  /**
   * Create a single example for a function.
   * POST /v3/functions/{name}/examples
   */
  async createExample(name: string, body: Example, options?: RequestOptions): Promise<Example> {
    return this.post<Example>(`/v3/functions/${encodeURIComponent(name)}/examples`, body, options);
  }

  /**
   * Batch create multiple examples for a function.
   * POST /v3/functions/{name}/examples/batch
   */
  async createExamplesBatch(
    name: string,
    body: Example[],
    options?: RequestOptions,
  ): Promise<Example[]> {
    return this.post<Example[]>(
      `/v3/functions/${encodeURIComponent(name)}/examples/batch`,
      body,
      options,
    );
  }

  /**
   * List examples for a function.
   * GET /v3/functions/{name}/examples
   */
  async listExamples(
    name: string,
    params?: ListExamplesParams,
    options?: RequestOptions,
  ): Promise<ListExamplesResponse> {
    return this.get<ListExamplesResponse>(
      `/v3/functions/${encodeURIComponent(name)}/examples`,
      {
        limit: params?.limit,
        offset: params?.offset,
        tag: params?.tag,
      },
      options,
    );
  }

  /**
   * Delete an example.
   * DELETE /v3/functions/{name}/examples/{uuid}
   */
  async deleteExample(name: string, uuid: string, options?: RequestOptions): Promise<void> {
    return this.delete<void>(
      `/v3/functions/${encodeURIComponent(name)}/examples/${encodeURIComponent(uuid)}`,
      options,
    );
  }
}
