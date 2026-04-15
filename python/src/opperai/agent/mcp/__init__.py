"""MCP Tool Provider — Public API.

Connect to MCP servers (stdio, SSE, streamable-http), discover tools dynamically.
The ``mcp`` package is lazy-imported — never a required dependency.

Example::

    from opperai.agent import Agent
    from opperai.agent.mcp import mcp, MCPStdioConfig

    agent = Agent(
        name="fs-assistant",
        instructions="You have filesystem access.",
        tools=[
            mcp(MCPStdioConfig(
                name="filesystem",
                command="uvx",
                args=["mcp-server-filesystem", "/tmp"],
            )),
        ],
    )
"""

from __future__ import annotations

from ._provider import MCPToolProvider
from ._types import (
    MCPServerConfig,
    MCPSSEConfig,
    MCPStdioConfig,
    MCPStreamableHTTPConfig,
)


def mcp(config: MCPServerConfig) -> MCPToolProvider:
    """Create an MCP tool provider from a server configuration.

    The provider connects to the MCP server on agent ``run()`` / ``stream()``,
    discovers available tools, and disconnects after the run completes.

    Requires the ``mcp`` package to be installed (optional dependency).
    """
    return MCPToolProvider(config)


__all__ = [
    "mcp",
    "MCPToolProvider",
    "MCPServerConfig",
    "MCPStdioConfig",
    "MCPSSEConfig",
    "MCPStreamableHTTPConfig",
]
