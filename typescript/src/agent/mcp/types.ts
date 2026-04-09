// =============================================================================
// MCP Tool Provider — Configuration Types
// =============================================================================

/** Stdio transport — spawns a local subprocess. */
export interface MCPStdioConfig {
  name: string;
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/** SSE transport — connects to a remote Server-Sent Events endpoint. */
export interface MCPSSEConfig {
  name: string;
  transport: "sse";
  url: string;
  headers?: Record<string, string>;
}

/** Streamable HTTP transport — the newer MCP HTTP transport. */
export interface MCPStreamableHTTPConfig {
  name: string;
  transport: "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

/** Union of all supported MCP server configurations. */
export type MCPServerConfig = MCPStdioConfig | MCPSSEConfig | MCPStreamableHTTPConfig;
