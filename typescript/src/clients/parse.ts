// =============================================================================
// Parse Client for Task API SDK
// =============================================================================

import { BaseClient } from '../client-base.js';
import { ParseRequest, ParseResponse } from '../types.js';

/**
 * Client for the Parse API endpoints.
 * Provides methods to parse Starlark scripts and retrieve AST and metadata.
 */
export class ParseClient extends BaseClient {
  /**
   * Parse a Starlark script and return its AST and metadata.
   *
   * @param body - The parse request containing the Starlark source code
   * @returns The parsed script information
   */
  async parseStarlark(body: ParseRequest): Promise<ParseResponse> {
    return this.post<ParseResponse>('/v3/parse', body);
  }
}

