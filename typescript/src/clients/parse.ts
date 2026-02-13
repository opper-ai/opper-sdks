import { BaseClient } from '../client-base.js';
import type { ParseRequest, ParseStarlarkResponse } from '../types.js';
import type { RequestOptions } from '../client-base.js';

/**
 * Client for the Parse API endpoints.
 *
 * Provides functionality for parsing Starlark scripts and returning
 * AST and metadata information.
 */
export class ParseClient extends BaseClient {
  /**
   * Parse a Starlark script and return its AST and metadata.
   *
   * @param body - The parse request containing the Starlark source code.
   * @param options - Optional request options (headers, signal, etc.).
   * @returns The parsed script information including AST and metadata.
   */
  async parseStarlark(
    body: ParseRequest,
    options?: RequestOptions,
  ): Promise<ParseStarlarkResponse> {
    return this.post<ParseStarlarkResponse>('/v3/parse', body, options);
  }
}

