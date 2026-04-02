// MCP Stdio Example — connect to a local MCP server and use its tools
//
// This example starts a local filesystem MCP server via stdio and lets
// the agent use it to list and read files.
//
// Prerequisites:
//   npm install @modelcontextprotocol/sdk
//
// Run with:
//   npx tsx examples/agents/09-mcp-stdio.ts

import { Agent, mcp } from "../../src/index.js";

// Define the MCP server as a reusable constant
const FilesystemMCP = mcp({
  name: "filesystem",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
});

const agent = new Agent({
  name: "file-explorer",
  instructions:
    "You are a helpful file explorer. Use the filesystem tools to answer questions about files. Be concise.",
  tools: [FilesystemMCP],
});

const result = await agent.run(
  "List the files in the current directory and tell me what this project is about based on the package.json.",
);

console.log("Answer:", result.output);
console.log("\nTool calls made:");
for (const call of result.meta.toolCalls) {
  console.log(` - ${call.name}(${JSON.stringify(call.input)}) (${call.durationMs}ms)`);
}
console.log("\nIterations:", result.meta.iterations);
console.log("Tokens used:", result.meta.usage.totalTokens);
