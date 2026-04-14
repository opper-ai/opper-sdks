"""MCP Tool Provider — connects to MCP servers and exposes tools to the agent."""

from __future__ import annotations

import re
from typing import Any

from .._types import AgentTool
from ._client import MCPClient
from ._types import MCPServerConfig


def _normalize_name(name: str) -> str:
    """Normalize a name for use in tool identifiers (replace non-alphanumeric with underscore)."""
    return re.sub(r"[^a-zA-Z0-9_]", "_", name)


def _sanitize_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Sanitize a JSON Schema so it is accepted by the OpenResponses API.

    Some MCP servers emit ``type: ["string", "null"]`` which is valid JSON Schema
    but rejected by many LLM APIs that expect a single string. This recursively
    converts array types to their first non-null entry.
    """
    result = dict(schema)

    if isinstance(result.get("type"), list):
        non_null = [t for t in result["type"] if t != "null"]
        result["type"] = non_null[0] if len(non_null) == 1 else (non_null[0] if non_null else "string")

    if isinstance(result.get("properties"), dict):
        result["properties"] = {
            key: _sanitize_schema(value) if isinstance(value, dict) else value
            for key, value in result["properties"].items()
        }

    if isinstance(result.get("items"), dict):
        result["items"] = _sanitize_schema(result["items"])

    return result


class MCPToolProvider:
    """MCP tool provider — connects to one MCP server, discovers tools, and
    wraps them as ``AgentTool`` instances for the agent loop.

    Tool naming follows the ``mcp__<serverName>__<toolName>`` convention.
    """

    def __init__(self, config: MCPServerConfig) -> None:
        self._config = config
        self._client: MCPClient | None = None

    async def setup(self) -> list[AgentTool]:
        client = MCPClient(self._config)
        self._client = client
        await client.connect()

        mcp_tools = await client.list_tools()
        return [self._wrap_tool(t) for t in mcp_tools]

    async def teardown(self) -> None:
        if self._client is not None:
            await self._client.disconnect()
            self._client = None

    def _wrap_tool(self, mcp_tool: Any) -> AgentTool:
        server_prefix = _normalize_name(self._config.name)
        tool_suffix = _normalize_name(mcp_tool.name)
        qualified_name = f"mcp__{server_prefix}__{tool_suffix}"
        client = self._client
        original_name = mcp_tool.name

        async def execute(**kwargs: Any) -> Any:
            assert client is not None
            return await client.call_tool(original_name, kwargs if kwargs else None)

        return AgentTool(
            name=qualified_name,
            description=mcp_tool.description,
            parameters=_sanitize_schema(mcp_tool.input_schema),
            execute=execute,
        )
