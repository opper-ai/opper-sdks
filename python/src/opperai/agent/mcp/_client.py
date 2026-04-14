"""MCP Tool Provider — Client (lazy imports, no top-level MCP SDK dependency)."""

from __future__ import annotations

from contextlib import AsyncExitStack
from dataclasses import dataclass
from typing import Any

from ._types import MCPServerConfig

MISSING_SDK_MESSAGE = (
    "The 'mcp' package is required for MCP support. "
    "Install it with: pip install mcp"
)


@dataclass
class MCPToolInfo:
    """Normalized MCP tool definition from tools/list."""

    name: str
    description: str
    input_schema: dict[str, Any]


class MCPClient:
    """MCP client wrapper with lazy imports.

    All ``mcp`` SDK imports happen inside async methods so the package
    is never loaded unless MCP is actually used.

    Uses ``AsyncExitStack`` to keep transport and session context managers
    alive for the entire client lifetime — required by the MCP SDK's
    anyio-based task groups.
    """

    def __init__(self, config: MCPServerConfig) -> None:
        self._config = config
        self._session: Any = None
        self._exit_stack: AsyncExitStack | None = None
        self._connected = False
        self._tool_cache: list[MCPToolInfo] | None = None

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        if self._connected:
            return

        try:
            from mcp import ClientSession  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(MISSING_SDK_MESSAGE) from None

        stack = AsyncExitStack()
        await stack.__aenter__()

        try:
            read, write = await self._enter_transport(stack)
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            self._session = session
            self._exit_stack = stack
            self._connected = True
        except Exception:
            await stack.aclose()
            raise

    async def disconnect(self) -> None:
        if not self._connected:
            return

        self._connected = False
        self._session = None
        self._tool_cache = None

        if self._exit_stack is not None:
            try:
                await self._exit_stack.aclose()
            except Exception:
                pass
            self._exit_stack = None

    async def list_tools(self) -> list[MCPToolInfo]:
        if not self._connected or self._session is None:
            raise RuntimeError(f'MCP server "{self._config.name}" is not connected')
        if self._tool_cache is not None:
            return self._tool_cache

        response = await self._session.list_tools()
        tools: list[MCPToolInfo] = [
            MCPToolInfo(
                name=t.name,
                description=t.description or "",
                input_schema=dict(t.inputSchema) if t.inputSchema else {},
            )
            for t in (response.tools or [])
        ]

        self._tool_cache = tools
        return tools

    async def call_tool(
        self, tool_name: str, args: dict[str, Any] | None = None
    ) -> Any:
        if not self._connected or self._session is None:
            raise RuntimeError(f'MCP server "{self._config.name}" is not connected')

        result = await self._session.call_tool(tool_name, arguments=args or {})

        # Extract text content from MCP CallToolResult
        text_parts: list[str] = []
        for content in result.content or []:
            if hasattr(content, "type") and content.type == "text" and hasattr(content, "text"):
                text_parts.append(content.text)

        text = "\n".join(text_parts)

        if result.isError:
            return {"error": text or "MCP tool call failed"}

        # Try to parse as JSON
        if text.startswith("{") or text.startswith("["):
            import json

            try:
                return json.loads(text)
            except (json.JSONDecodeError, ValueError):
                pass

        return text

    async def _enter_transport(self, stack: AsyncExitStack) -> tuple[Any, Any]:
        """Create and enter the appropriate MCP transport context manager."""
        try:
            if self._config.transport == "stdio":
                from mcp.client.stdio import StdioServerParameters, stdio_client  # type: ignore[import-untyped]

                params = StdioServerParameters(
                    command=self._config.command,  # type: ignore[attr-defined]
                    args=self._config.args or [],  # type: ignore[attr-defined]
                    env=self._config.env,  # type: ignore[attr-defined]
                    cwd=self._config.cwd,  # type: ignore[attr-defined]
                )
                return await stack.enter_async_context(stdio_client(params))

            elif self._config.transport == "sse":
                from mcp.client.sse import sse_client  # type: ignore[import-untyped]

                return await stack.enter_async_context(
                    sse_client(
                        url=self._config.url,  # type: ignore[attr-defined]
                        headers=self._config.headers or {},  # type: ignore[attr-defined]
                    )
                )

            elif self._config.transport == "streamable-http":
                import httpx  # type: ignore[import-untyped]
                from mcp.client.streamable_http import streamable_http_client  # type: ignore[import-untyped]

                headers = self._config.headers  # type: ignore[attr-defined]
                http_client = httpx.AsyncClient(headers=headers) if headers else None
                read, write, *_ = await stack.enter_async_context(
                    streamable_http_client(
                        url=self._config.url,  # type: ignore[attr-defined]
                        http_client=http_client,
                    )
                )
                return read, write

            else:
                raise ValueError(f"Unknown MCP transport: {self._config.transport}")

        except ImportError:
            raise ImportError(MISSING_SDK_MESSAGE) from None
