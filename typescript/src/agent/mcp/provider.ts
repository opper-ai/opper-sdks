// =============================================================================
// MCP Tool Provider — connects to MCP servers and exposes tools to the agent
// =============================================================================

import type { AgentTool, ToolProvider } from "../types.js";
import { MCPClient } from "./client.js";
import type { MCPServerConfig } from "./types.js";

/** Normalize a name for use in tool identifiers (replace non-alphanumeric with underscore). */
function normalizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Sanitize a JSON Schema so it is accepted by the OpenResponses API.
 *
 * Some MCP servers (e.g. Composio) emit `type: ["string", "null"]` which is
 * valid JSON Schema but rejected by many LLM APIs that expect a single string.
 * This recursively converts array types to their first non-null entry.
 */
function sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema };

  if (Array.isArray(result.type)) {
    const nonNull = result.type.filter((t: string) => t !== "null");
    result.type = nonNull.length === 1 ? nonNull[0] : nonNull.length > 0 ? nonNull[0] : "string";
  }

  if (result.properties && typeof result.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.properties as Record<string, unknown>)) {
      props[key] =
        value && typeof value === "object"
          ? sanitizeSchema(value as Record<string, unknown>)
          : value;
    }
    result.properties = props;
  }

  if (result.items && typeof result.items === "object") {
    result.items = sanitizeSchema(result.items as Record<string, unknown>);
  }

  return result;
}

/**
 * MCP tool provider — connects to one MCP server, discovers tools, and
 * wraps them as `AgentTool` instances for the agent loop.
 *
 * Tool naming follows the `mcp__serverName__toolName` convention.
 */
export class MCPToolProvider implements ToolProvider {
  readonly type = "tool_provider" as const;

  private readonly config: MCPServerConfig;
  private client: MCPClient | null = null;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  async setup(): Promise<AgentTool[]> {
    this.client = new MCPClient(this.config);
    await this.client.connect();

    const mcpTools = await this.client.listTools();
    return mcpTools.map((t) => this.wrapTool(t));
  }

  async teardown(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  private wrapTool(mcpTool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }): AgentTool {
    const serverPrefix = normalizeName(this.config.name);
    const toolSuffix = normalizeName(mcpTool.name);
    const qualifiedName = `mcp__${serverPrefix}__${toolSuffix}`;
    const client = this.client!;
    const originalName = mcpTool.name;

    return {
      name: qualifiedName,
      description: mcpTool.description,
      parameters: sanitizeSchema(mcpTool.inputSchema),
      execute: async (input: unknown) => {
        const args =
          typeof input === "object" && input !== null
            ? (input as Record<string, unknown>)
            : input === undefined
              ? {}
              : { value: input };
        return client.callTool(originalName, args);
      },
    };
  }
}
