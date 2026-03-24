# Platform Issues & Suggestions

Discovered while building and testing the TypeScript SDK examples.

---

## Issue 1: Starlark script hardcodes input when schemas are omitted

**Severity:** High — produces incorrect results silently

When `input_schema` and `output_schema` are not provided, the generated Starlark script may hardcode the literal input from the first call instead of reading from `input.get("prompt")`. Subsequent calls with different input reuse the cached script and get the wrong (original) input.

**Reproduction:**
```bash
# First call creates and caches the script
curl -X POST .../functions/my-fn/call -d '{"input": "Weather in Stockholm?", "tools": [...]}'
# Returns: tool_call for Stockholm ✓

# Second call reuses cached script — but gets San Francisco
curl -X POST .../functions/my-fn/call -d '{"input": "Weather in Tokyo?", "tools": [...]}'
# Returns: tool_call for San Francisco ✗ (hardcoded from first call)
```

**Workaround:** Always provide `input_schema` and `output_schema`. The script generator produces properly parameterized scripts when schemas are present.

**Root cause:** The script generator embeds the input value literally in the generated code rather than using `input.get(...)` when there's no schema to guide it.

---

## Issue 2: Cached Starlark script may not surface tool_calls correctly

**Severity:** Medium — inconsistent behavior depending on cached script

The platform *does* support returning tool calls. The `llm()` builtin returns `{content, tool_calls}` and the reference test script (`09_tool_calling.star`) correctly passes them through:

```python
result = llm(messages=..., tools=tools, prefer="balanced")
tool_calls = result.get("tool_calls", [])
if tool_calls:
    message["tool_calls"] = tool_calls
return {"choices": [{"message": message}]}
```

However, when the script generator produces a script for a request with tools + `output_schema`, it may generate a script that tries to satisfy the output schema directly instead of surfacing the raw `tool_calls`. This is related to Issue 1 — the script generator sometimes produces scripts that don't properly handle the tool-use flow, especially when the output schema doesn't include a `tool_calls` field.

**Observed behavior:** LLM returned a valid `tool_use` response (confirmed in Anthropic traces), but the generated Starlark script fabricated placeholder results (`"Example Result 1"`) to match the output schema instead of returning the tool call for the caller to handle.

**Expected:** When tools are provided, the generated script should either:
1. Return tool_calls in the output so the caller can execute them locally, or
2. If the output_schema has no `tool_calls` field, clearly document that the platform will attempt to satisfy the schema autonomously (which may not work for tools that need external execution)

---

## Suggestion: Support Anthropic server-side tools

Anthropic offers server-side tools (web search, code execution) that are executed by Anthropic's infrastructure — no client-side tool execution needed.

**API format:**
```json
{
  "tools": [
    {
      "type": "web_search_20250305",
      "name": "web_search",
      "max_uses": 5
    }
  ]
}
```

Docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

**Current gap:** The Anthropic adapter in task-api converts all tools to the standard `{"name", "input_schema"}` format. Server-side tools use a different shape (`type` field instead of `input_schema`) and are not passed through.

**Suggested implementation:**
1. In the Anthropic adapter's tool conversion, detect tools with a `type` field (e.g., `web_search_20250305`) and pass them through as-is instead of converting
2. Handle the response: server-side tool results come back as `tool_result` content blocks with `type: "web_search_tool_result"` containing search results
3. In the Starlark `llm()` builtin, surface server-side tool results in the response so scripts can use them
4. In the SDK, allow passing server-side tools alongside regular tools — they just need a `type` field instead of `parameters`

This would enable patterns like:
```typescript
const result = await opper.call("research", {
  model: "anthropic/claude-sonnet-4.6",
  tools: [
    { type: "web_search_20250305", name: "web_search" },  // server-side
    { name: "my_tool", parameters: z.object({...}) },      // regular
  ],
  output_schema: z.object({ answer: z.string(), sources: z.array(z.string()) }),
  input: { question: "What is quantum computing?" },
});
```
