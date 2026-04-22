# MCP stdio — connect to an MCP server and use its tools
#
# Requires:
#   - the `mcp` Python package (already a dependency of opperai)
#   - npx (ships with Node.js) — used to run the official filesystem MCP server
#
# The official filesystem MCP server is published to npm as
# @modelcontextprotocol/server-filesystem, so we launch it with npx (mirroring
# the TypeScript example).

import asyncio

from opperai.agent import Agent
from opperai.agent.mcp import MCPStdioConfig, mcp


async def main() -> None:
    agent = Agent(
        name="fs-assistant",
        instructions=(
            "You have filesystem access via MCP tools. "
            "Be concise in your responses."
        ),
        tools=[
            mcp(
                MCPStdioConfig(
                    name="filesystem",
                    command="npx",
                    args=["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
                )
            ),
        ],
    )

    result = await agent.run("List the files in /tmp and tell me how many there are.")
    print("Answer:", result.output)
    print(f"\nIterations: {result.meta.iterations}")
    print(f"Tokens: {result.meta.usage.total_tokens}")
    print(f"Tool calls: {len(result.meta.tool_calls)}")

    # Show which MCP tools were called
    for tc in result.meta.tool_calls:
        print(f"  {tc.name}: {tc.duration_ms:.0f}ms")


if __name__ == "__main__":
    asyncio.run(main())
