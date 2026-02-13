// =============================================================================
// Task API SDK - Parse Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import { ParseRequest, RequestOptions } from '../types.js';

/**
 * Client for parsing Starlark scripts.
 * Parses Starlark source code and returns AST and metadata.
 */
export class ParseClient extends BaseClient {
  /**
   * Parse a Starlark script and return its AST and metadata.
   *
   * @param body - The parse request containing the Starlark source code.
   * @param options - Optional request options.
   * @returns Parsed script information including AST and metadata.
   */
  async parseStarlark(
    body: ParseRequest,
    options?: RequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/v3/parse', body, options);
  }
}

