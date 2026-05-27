"""
Datadog Error Summary Agent — Datadog MCP server, env-key authenticated.

Multi-step agent that surveys the last 2 hours of error logs across all
services in Datadog and produces a structured summary: total count, plus a
short blurb per distinct error.

What this demonstrates:
  - Wiring an external MCP server to the opperai Agent via streamable HTTP.
  - Authenticating that MCP via static env-var headers (the Claude-Code
    pattern), not OAuth.
  - Driving a multi-step investigation: aggregate counts, sample raw entries,
    group by service, summarize each.

Prerequisites:
  - OPPER_API_KEY in .env
  - DATADOG_API_KEY in .env (organization API key)
  - DATADOG_APP_KEY in .env (user application key with MCP read scopes)
  - Optional DATADOG_SITE in .env — defaults to datadoghq.eu. Other values:
    datadoghq.com (US1), us3.datadoghq.com, us5.datadoghq.com, ap1.datadoghq.com
  - pip install mcp

Run with:
  cd python
  PYTHONPATH=src uv run --env-file ../.env python \\
    examples/agents/applied_agents/datadog_error_summary_agent.py
"""

import asyncio
import json
import os
from datetime import datetime

from pydantic import BaseModel, Field

from opperai.agent import Agent, Hooks
from opperai.agent.mcp import MCPStreamableHTTPConfig, mcp

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ErrorEntry(BaseModel):
    service: str = Field(description="Service that emitted the error, or 'unknown'")
    error_type: str = Field(description="Short label for the error class (exception, status, etc.)")
    count: int = Field(description="Number of occurrences in the time window")
    summary: str = Field(description="One-sentence summary of what the error looks like")
    first_seen: str | None = Field(default=None, description="ISO 8601 of earliest occurrence")
    last_seen: str | None = Field(default=None, description="ISO 8601 of most recent occurrence")


class ErrorReport(BaseModel):
    time_window_hours: int = Field(description="Window analyzed, in hours")
    total_errors: int = Field(description="Total error count across all services")
    distinct_errors: int = Field(description="Number of distinct error classes")
    services_affected: list[str] = Field(description="Services with at least one error")
    errors: list[ErrorEntry] = Field(description="Per-error-class breakdown")
    headline: str = Field(description="One-line takeaway suitable for a Slack post")


# ---------------------------------------------------------------------------
# MCP wiring — Datadog hosted MCP server, auth via env-var headers
# ---------------------------------------------------------------------------


def _require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise SystemExit(
            f"Missing {key} in environment. See the docstring at the top of this file."
        )
    return value


datadog_api_key = _require_env("DATADOG_API_KEY")
datadog_app_key = _require_env("DATADOG_APP_KEY")
datadog_site = os.environ.get("DATADOG_SITE", "datadoghq.eu")

datadog_mcp = mcp(
    MCPStreamableHTTPConfig(
        name="datadog",
        url=f"https://mcp.{datadog_site}/api/unstable/mcp-server/mcp",
        headers={
            "DD_API_KEY": datadog_api_key,
            "DD_APPLICATION_KEY": datadog_app_key,
        },
    )
)

# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

WINDOW_HOURS = 2

instructions = f"""
You are a site-reliability assistant. Produce a concise report of all error
logs from the last {WINDOW_HOURS} hours across every service in Datadog.

Workflow:
1. Use the Datadog log analysis tool to count total error-level logs in the
   last {WINDOW_HOURS} hours, grouped by service.
2. For each service with errors, sample a handful of representative log
   entries (status:error) to identify the distinct error classes.
3. For each distinct error class, count occurrences and capture a short
   one-sentence summary plus first_seen and last_seen timestamps.
4. Produce a headline that captures the top 1-2 issues — something a humans
   can paste into Slack.

Guidelines:
- Prefer aggregation tools over fetching thousands of raw logs.
- If there are no errors, return an empty report with a "all clear" headline.
- Be deterministic about the time window: end at "now", start at "now minus {WINDOW_HOURS}h".
""".strip()

hooks = Hooks(
    on_iteration_start=lambda ctx: print(f"\n--- Iteration {ctx['iteration']} ---"),
    on_tool_start=lambda ctx: print(
        f"  -> {ctx['name']}({json.dumps(ctx['input'])[:140]}"
        f"{'...' if len(json.dumps(ctx['input'])) > 140 else ''})"
    ),
    on_tool_end=lambda ctx: (
        print(f"  x {ctx['name']} failed ({ctx['duration_ms']:.0f}ms): {ctx['error']}")
        if ctx.get("error")
        else print(
            f"  <- {ctx['name']} ({ctx['duration_ms']:.0f}ms): "
            f"{json.dumps(ctx['output'])[:160]}"
            f"{'...' if len(json.dumps(ctx['output'])) > 160 else ''}"
        )
    ),
    on_agent_end=lambda ctx: (
        print(f"\nx Agent failed: {ctx['error']}")
        if ctx.get("error")
        else print(f"\nv Agent completed in {ctx['result'].meta.iterations} iteration(s)")
        if ctx.get("result")
        else None
    ),
)

agent = Agent(
    name="datadog-error-summary",
    instructions=instructions,
    output_schema=ErrorReport,
    model="anthropic/claude-sonnet-4-6",
    tools=[datadog_mcp],
    max_iterations=20,
    hooks=hooks,
)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


async def main() -> None:
    _require_env("OPPER_API_KEY")
    now = datetime.now().isoformat(timespec="seconds")
    print("Datadog Error Summary Agent")
    print("=" * 60)
    print(f"Now: {now}")
    print(f"Window: last {WINDOW_HOURS} hours")
    print(f"Site: {datadog_site}\n")
    print("Running...\n")

    try:
        result = await agent.run(
            f"Summarize all error logs from the last {WINDOW_HOURS} hours."
        )
        report: ErrorReport = result.output
        print("=" * 60)
        print("ERROR SUMMARY")
        print("=" * 60)
        print(f"\nHeadline: {report.headline}")
        print(f"\nTotal errors:    {report.total_errors}")
        print(f"Distinct errors: {report.distinct_errors}")
        print(f"Services hit:    {', '.join(report.services_affected) or '(none)'}")
        if report.errors:
            print("\nBreakdown:")
            for e in report.errors:
                print(f"  [{e.count:>4}] {e.service} :: {e.error_type}")
                print(f"         {e.summary}")
                if e.first_seen or e.last_seen:
                    print(f"         first={e.first_seen} last={e.last_seen}")
        print(f"\nTokens used: {result.meta.usage.total_tokens}")
        print(f"Iterations:  {result.meta.iterations}")
        print(f"Tool calls:  {len(result.meta.tool_calls)}")
    except Exception as err:
        print(f"\nError: {err}")
        cause = getattr(err, "cause", None) or getattr(err, "__cause__", None)
        if cause:
            print(f"Cause: {cause}")
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
