"""MCP Tool Provider — Configuration types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TypeAlias


@dataclass(frozen=True)
class MCPStdioConfig:
    """Stdio transport — spawns a local subprocess."""

    name: str
    command: str
    args: list[str] = field(default_factory=list)
    env: dict[str, str] | None = None
    cwd: str | None = None
    transport: str = "stdio"


@dataclass(frozen=True)
class MCPSSEConfig:
    """SSE transport — connects to a remote Server-Sent Events endpoint."""

    name: str
    url: str
    headers: dict[str, str] | None = None
    transport: str = "sse"


@dataclass(frozen=True)
class MCPStreamableHTTPConfig:
    """Streamable HTTP transport — the newer MCP HTTP transport."""

    name: str
    url: str
    headers: dict[str, str] | None = None
    transport: str = "streamable-http"


MCPServerConfig: TypeAlias = MCPStdioConfig | MCPSSEConfig | MCPStreamableHTTPConfig
