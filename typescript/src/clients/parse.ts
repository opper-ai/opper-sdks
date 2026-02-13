import { BaseClient } from '../client-base.js';
import type { ParseRequest, ParseStarlarkResponse } from '../types.js';
import type { RequestOptions } from '../client-base.js';

/**
 * Client for the Parse API endpoints.
 *
 * Provides the ability to parse Starlark scripts, returning
 * AST and metadata information.
 */
export class ParseClient extends BaseClient {
  /**
   * Parse a Starlark script and return its AST and metadata.
   *
   * @param body - The parse request containing the Starlark source code.
   * @param options - Optional request options (headers, signal, etc.)
   * @returns A promise resolving to the parsed AST and metadata.
   */
  async parseStarlark(
    body: ParseRequest,
    options?: RequestOptions,
  ): Promise<ParseStarlarkResponse> {
    return this.post<ParseStarlarkResponse>('/v3/parse', body, options);
  }
}

