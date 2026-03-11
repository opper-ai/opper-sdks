import { BaseClient } from "../client-base.js";
import type { ParseRequest } from "../types.js";

/**
 * Client for the Parse API endpoints.
 * Provides methods to parse Starlark scripts.
 */
export class ParseClient extends BaseClient {
  /**
   * Parse a Starlark script and return its AST and metadata.
   *
   * @param body - The parse request containing the Starlark source code.
   * @returns The parsed script information.
   */
  async parseStarlark(body: ParseRequest): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("/v3/parse", body);
  }
}
