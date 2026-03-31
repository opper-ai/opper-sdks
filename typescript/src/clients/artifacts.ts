import { BaseClient } from "../client-base.js";
import type { ArtifactStatus, RequestOptions } from "../types.js";

/**
 * Client for the Artifacts API endpoints.
 * Provides methods to poll async artifact generation status.
 */
export class ArtifactsClient extends BaseClient {
  /**
   * Poll for async artifact generation status.
   * Returns a presigned download URL when the generation is complete.
   *
   * GET /v3/artifacts/:id/status
   *
   * @param id - Artifact generation ID
   * @param options - Optional request options (headers, signal, etc.)
   * @returns A promise that resolves with the artifact status.
   */
  async getStatus(id: string, options?: RequestOptions): Promise<ArtifactStatus> {
    return this.get<ArtifactStatus>(
      `/v3/artifacts/${encodeURIComponent(id)}/status`,
      undefined,
      options,
    );
  }
}
