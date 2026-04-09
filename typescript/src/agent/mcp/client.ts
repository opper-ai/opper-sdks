// =============================================================================
// MCP Tool Provider — Client (dynamic imports, no top-level MCP SDK dependency)
// =============================================================================

import type { MCPServerConfig } from "./types.js";

/** Normalized MCP tool definition from tools/list. */
export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const MISSING_SDK_MESSAGE =
  "@modelcontextprotocol/sdk is required for MCP support. Install it with: npm install @modelcontextprotocol/sdk";

/**
 * MCP client wrapper with dynamic imports.
 *
 * All `@modelcontextprotocol/sdk` imports happen lazily inside async methods,
 * so the package is never loaded unless MCP is actually used.
 */
export class MCPClient {
  private readonly config: MCPServerConfig;
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK types are loaded dynamically
  private client: any = null;
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK transport loaded dynamically
  private transport: any = null;
  private connected = false;
  private toolCache: MCPToolInfo[] | null = null;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const transport = await this.createTransport();
    this.transport = transport;

    let Client: new (...args: unknown[]) => unknown;
    try {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic import
      const mod: any = await import("@modelcontextprotocol/sdk/client/index.js");
      Client = mod.Client;
    } catch {
      throw new Error(MISSING_SDK_MESSAGE);
    }

    this.client = new Client(
      { name: "opper-agent-mcp-client", version: "1.0.0" },
      { enforceStrictCapabilities: false },
    );

    try {
      await this.client.connect(transport);
      this.connected = true;
    } catch (err) {
      await this.transport?.close?.().catch(() => {});
      this.transport = null;
      this.client = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    await this.client?.close().catch(() => {});
    await this.transport?.close().catch(() => {});
    this.client = null;
    this.transport = null;
    this.connected = false;
    this.toolCache = null;
  }

  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.connected || !this.client) {
      throw new Error(`MCP server "${this.config.name}" is not connected`);
    }
    if (this.toolCache) return this.toolCache;

    const response = await this.client.listTools({});
    const tools: MCPToolInfo[] =
      // biome-ignore lint/suspicious/noExplicitAny: MCP SDK tool type
      response.tools?.map((t: any) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
      })) ?? [];

    this.toolCache = tools;
    return tools;
  }

  async callTool(toolName: string, args: Record<string, unknown> | undefined): Promise<unknown> {
    if (!this.connected || !this.client) {
      throw new Error(`MCP server "${this.config.name}" is not connected`);
    }

    const result = await this.client.callTool({ name: toolName, arguments: args });

    // Extract text content from MCP CallToolResult
    const textParts: string[] =
      result.content
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK content type
        ?.filter((c: any) => c.type === "text" && c.text != null)
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK content type
        .map((c: any) => c.text as string) ?? [];

    const text = textParts.join("\n");

    if (result.isError) {
      return { error: text || "MCP tool call failed" };
    }

    // Try to parse as JSON if it looks like it
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return JSON.parse(text);
      } catch {
        // Not valid JSON, return as string
      }
    }

    return text;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private async createTransport(): Promise<unknown> {
    try {
      switch (this.config.transport) {
        case "stdio": {
          const mod = await import("@modelcontextprotocol/sdk/client/stdio.js");
          return new mod.StdioClientTransport({
            command: this.config.command,
            ...(this.config.args?.length ? { args: this.config.args } : {}),
            ...(this.config.env && Object.keys(this.config.env).length > 0
              ? { env: this.config.env }
              : {}),
            ...(this.config.cwd ? { cwd: this.config.cwd } : {}),
            stderr: "pipe",
          });
        }

        case "sse": {
          const mod = await import("@modelcontextprotocol/sdk/client/sse.js");
          const headers = this.config.headers ?? {};
          const headerEntries = Object.entries(headers);

          const options: Record<string, unknown> = {};
          if (headerEntries.length > 0) {
            options.eventSourceInit = {
              fetch: async (url: string | URL, init?: RequestInit) => {
                const mergedHeaders = new Headers(init?.headers ?? {});
                for (const [key, value] of headerEntries) {
                  mergedHeaders.set(key, value);
                }
                if (!mergedHeaders.has("Accept")) {
                  mergedHeaders.set("Accept", "text/event-stream");
                }
                return fetch(url, { ...init, headers: mergedHeaders });
              },
            };
            options.requestInit = { headers };
          }

          return new mod.SSEClientTransport(new URL(this.config.url), options);
        }

        case "streamable-http": {
          const mod = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
          const options: Record<string, unknown> = {};
          if (this.config.headers && Object.keys(this.config.headers).length > 0) {
            options.requestInit = { headers: this.config.headers };
          }
          return new mod.StreamableHTTPClientTransport(new URL(this.config.url), options);
        }
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("Cannot find module") || err.message.includes("ERR_MODULE_NOT_FOUND"))
      ) {
        throw new Error(MISSING_SDK_MESSAGE);
      }
      throw err;
    }
  }
}
