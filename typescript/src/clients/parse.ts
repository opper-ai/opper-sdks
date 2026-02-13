// =============================================================================
// Task API SDK - Parse Client
// =============================================================================

import { BaseClient } from '../client-base.js';
import type { ParseRequest } from '../types.js';

/**
 * Response from parsing a Starlark script.
 * Contains the AST and metadata of the parsed script.
 */
export interface ParseStarlarkResponse {
  readonly [key: string]: unknown;
}

/**
 * Client for the Parse API endpoints.
 *
 * Provides methods for parsing Starlark scripts and retrieving
 * their AST and metadata.
 */
export class ParseClient extends BaseClient {
  /**
   * Parse a Starlark script and return its AST and metadata.
   *
   * @param body - The parse request containing the Starlark source code
   * @returns The parsed script information including AST and metadata
   *
   * @example
   * ```typescript
   * const parseClient = new ParseClient({ apiKey: 'your-api-key' });
   * const result = await parseClient.parseStarlark({ source: 'print("hello")' });
   * console.log(result);
   * ```
   */
  async parseStarlark(body: ParseRequest): Promise<ParseStarlarkResponse> {
    return this.post<ParseStarlarkResponse>('/v3/parse', body);
  }
}

