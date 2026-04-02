// =============================================================================
// MCP Tool Provider — Public API
// =============================================================================

import type { ToolProvider } from "../types.js";
import { MCPToolProvider } from "./provider.js";
import type { MCPServerConfig } from "./types.js";

/**
 * Create an MCP tool provider from a server configuration.
 *
 * The provider connects to the MCP server on agent `run()` / `stream()`,
 * discovers available tools, and disconnects after the run completes.
 *
 * Requires `@modelcontextprotocol/sdk` to be installed (optional peer dependency).
 *
 * @example
 * ```typescript
 * import { Agent, mcp } from "opperai/agent";
 *
 * const agent = new Agent({
 *   name: "assistant",
 *   instructions: "You have filesystem access.",
 *   tools: [
 *     mcp({
 *       name: "fs",
 *       transport: "stdio",
 *       command: "npx",
 *       args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
 *     }),
 *   ],
 * });
 * ```
 */
export function mcp(config: MCPServerConfig): ToolProvider {
  return new MCPToolProvider(config);
}

export { MCPToolProvider } from "./provider.js";
export type {
  MCPServerConfig,
  MCPSSEConfig,
  MCPStdioConfig,
  MCPStreamableHTTPConfig,
} from "./types.js";
