"""Tests for MCP Tool Provider."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opperai.agent.mcp._client import MCPClient, MCPToolInfo
from opperai.agent.mcp._provider import MCPToolProvider, _normalize_name, _sanitize_schema
from opperai.agent.mcp._types import (
    MCPSSEConfig,
    MCPStdioConfig,
    MCPStreamableHTTPConfig,
)


# =============================================================================
# Config types
# =============================================================================


class TestMCPConfigs:
    def test_stdio_config(self) -> None:
        config = MCPStdioConfig(name="fs", command="uvx", args=["mcp-server-filesystem", "/tmp"])
        assert config.name == "fs"
        assert config.command == "uvx"
        assert config.args == ["mcp-server-filesystem", "/tmp"]
        assert config.transport == "stdio"
        assert config.env is None
        assert config.cwd is None

    def test_sse_config(self) -> None:
        config = MCPSSEConfig(name="remote", url="http://localhost:8080/sse", headers={"Authorization": "Bearer tok"})
        assert config.name == "remote"
        assert config.url == "http://localhost:8080/sse"
        assert config.transport == "sse"
        assert config.headers == {"Authorization": "Bearer tok"}

    def test_streamable_http_config(self) -> None:
        config = MCPStreamableHTTPConfig(name="api", url="http://localhost:8080/mcp")
        assert config.name == "api"
        assert config.url == "http://localhost:8080/mcp"
        assert config.transport == "streamable-http"
        assert config.headers is None


# =============================================================================
# Normalize name
# =============================================================================


class TestNormalizeName:
    def test_simple(self) -> None:
        assert _normalize_name("read_file") == "read_file"

    def test_with_special_chars(self) -> None:
        assert _normalize_name("my-tool.v2") == "my_tool_v2"

    def test_with_spaces(self) -> None:
        assert _normalize_name("my tool name") == "my_tool_name"


# =============================================================================
# Sanitize schema
# =============================================================================


class TestSanitizeSchema:
    def test_passthrough(self) -> None:
        schema = {"type": "object", "properties": {"x": {"type": "string"}}}
        assert _sanitize_schema(schema) == schema

    def test_array_type_to_single(self) -> None:
        schema = {"type": ["string", "null"]}
        result = _sanitize_schema(schema)
        assert result["type"] == "string"

    def test_nested_properties(self) -> None:
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]},
                "count": {"type": "integer"},
            },
        }
        result = _sanitize_schema(schema)
        assert result["properties"]["name"]["type"] == "string"
        assert result["properties"]["count"]["type"] == "integer"

    def test_array_items(self) -> None:
        schema = {"type": "array", "items": {"type": ["number", "null"]}}
        result = _sanitize_schema(schema)
        assert result["items"]["type"] == "number"

    def test_empty_array_type_defaults_to_string(self) -> None:
        schema = {"type": ["null"]}
        result = _sanitize_schema(schema)
        assert result["type"] == "string"


# =============================================================================
# MCPClient
# =============================================================================


class TestMCPClient:
    def test_init(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        assert not client.is_connected

    @pytest.mark.asyncio
    async def test_list_tools_not_connected(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        with pytest.raises(RuntimeError, match="not connected"):
            await client.list_tools()

    @pytest.mark.asyncio
    async def test_call_tool_not_connected(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        with pytest.raises(RuntimeError, match="not connected"):
            await client.call_tool("test", {})

    @pytest.mark.asyncio
    async def test_disconnect_when_not_connected(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        await client.disconnect()  # Should not raise
        assert not client.is_connected

    @pytest.mark.asyncio
    async def test_connect_missing_mcp_sdk(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        with patch.dict("sys.modules", {"mcp": None}):
            with pytest.raises(ImportError, match="mcp"):
                await client.connect()

    @pytest.mark.asyncio
    async def test_list_tools_caches(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        client._connected = True

        mock_tool = MagicMock()
        mock_tool.name = "read_file"
        mock_tool.description = "Read a file"
        mock_tool.inputSchema = {"type": "object", "properties": {"path": {"type": "string"}}}

        mock_response = MagicMock()
        mock_response.tools = [mock_tool]

        client._session = AsyncMock()
        client._session.list_tools = AsyncMock(return_value=mock_response)

        tools = await client.list_tools()
        assert len(tools) == 1
        assert tools[0].name == "read_file"
        assert tools[0].description == "Read a file"

        # Second call should use cache
        tools2 = await client.list_tools()
        assert tools2 is tools
        assert client._session.list_tools.call_count == 1

    @pytest.mark.asyncio
    async def test_call_tool_text_result(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        client._connected = True

        content = MagicMock()
        content.type = "text"
        content.text = "Hello, world!"

        mock_result = MagicMock()
        mock_result.content = [content]
        mock_result.isError = False

        client._session = AsyncMock()
        client._session.call_tool = AsyncMock(return_value=mock_result)

        result = await client.call_tool("greet", {"name": "Alice"})
        assert result == "Hello, world!"

    @pytest.mark.asyncio
    async def test_call_tool_json_result(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        client._connected = True

        content = MagicMock()
        content.type = "text"
        content.text = '{"files": ["a.txt", "b.txt"]}'

        mock_result = MagicMock()
        mock_result.content = [content]
        mock_result.isError = False

        client._session = AsyncMock()
        client._session.call_tool = AsyncMock(return_value=mock_result)

        result = await client.call_tool("list_files", {"dir": "/tmp"})
        assert result == {"files": ["a.txt", "b.txt"]}

    @pytest.mark.asyncio
    async def test_call_tool_error(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        client = MCPClient(config)
        client._connected = True

        content = MagicMock()
        content.type = "text"
        content.text = "File not found"

        mock_result = MagicMock()
        mock_result.content = [content]
        mock_result.isError = True

        client._session = AsyncMock()
        client._session.call_tool = AsyncMock(return_value=mock_result)

        result = await client.call_tool("read_file", {"path": "/missing"})
        assert result == {"error": "File not found"}


# =============================================================================
# MCPToolProvider
# =============================================================================


class TestMCPToolProvider:
    @pytest.mark.asyncio
    async def test_setup_and_teardown(self) -> None:
        config = MCPStdioConfig(name="fs", command="echo")
        provider = MCPToolProvider(config)

        mock_tools = [
            MCPToolInfo(
                name="read_file",
                description="Read a file",
                input_schema={"type": "object", "properties": {"path": {"type": "string"}}},
            ),
            MCPToolInfo(
                name="write_file",
                description="Write a file",
                input_schema={"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}},
            ),
        ]

        with patch.object(MCPClient, "connect", new_callable=AsyncMock):
            with patch.object(MCPClient, "list_tools", new_callable=AsyncMock, return_value=mock_tools):
                tools = await provider.setup()

        assert len(tools) == 2
        assert tools[0].name == "mcp__fs__read_file"
        assert tools[0].description == "Read a file"
        assert tools[1].name == "mcp__fs__write_file"

        # Teardown
        with patch.object(MCPClient, "disconnect", new_callable=AsyncMock) as mock_disconnect:
            await provider.teardown()
            mock_disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_tool_naming_convention(self) -> None:
        config = MCPStdioConfig(name="my-server.v2", command="echo")
        provider = MCPToolProvider(config)

        mock_tools = [
            MCPToolInfo(name="do-thing.now", description="Do a thing", input_schema={}),
        ]

        with patch.object(MCPClient, "connect", new_callable=AsyncMock):
            with patch.object(MCPClient, "list_tools", new_callable=AsyncMock, return_value=mock_tools):
                tools = await provider.setup()

        assert tools[0].name == "mcp__my_server_v2__do_thing_now"

    @pytest.mark.asyncio
    async def test_schema_sanitized(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        provider = MCPToolProvider(config)

        mock_tools = [
            MCPToolInfo(
                name="tool",
                description="A tool",
                input_schema={
                    "type": "object",
                    "properties": {"x": {"type": ["string", "null"]}},
                },
            ),
        ]

        with patch.object(MCPClient, "connect", new_callable=AsyncMock):
            with patch.object(MCPClient, "list_tools", new_callable=AsyncMock, return_value=mock_tools):
                tools = await provider.setup()

        assert tools[0].parameters["properties"]["x"]["type"] == "string"

    @pytest.mark.asyncio
    async def test_tool_execute_calls_mcp_client(self) -> None:
        config = MCPStdioConfig(name="fs", command="echo")
        provider = MCPToolProvider(config)

        mock_tools = [
            MCPToolInfo(
                name="read_file",
                description="Read a file",
                input_schema={"type": "object", "properties": {"path": {"type": "string"}}},
            ),
        ]

        mock_call_tool = AsyncMock(return_value="file contents")

        with patch.object(MCPClient, "connect", new_callable=AsyncMock):
            with patch.object(MCPClient, "list_tools", new_callable=AsyncMock, return_value=mock_tools):
                tools = await provider.setup()

        # Replace call_tool on the internal client
        assert provider._client is not None
        provider._client.call_tool = mock_call_tool

        result = await tools[0].execute(path="/tmp/test.txt")
        mock_call_tool.assert_called_once_with("read_file", {"path": "/tmp/test.txt"})
        assert result == "file contents"

    @pytest.mark.asyncio
    async def test_teardown_without_setup(self) -> None:
        config = MCPStdioConfig(name="test", command="echo")
        provider = MCPToolProvider(config)
        await provider.teardown()  # Should not raise


# =============================================================================
# mcp() factory
# =============================================================================


class TestMCPFactory:
    def test_creates_provider(self) -> None:
        from opperai.agent.mcp import mcp

        config = MCPStdioConfig(name="fs", command="echo")
        provider = mcp(config)
        assert isinstance(provider, MCPToolProvider)
        assert provider._config is config
