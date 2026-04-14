"""
Daily Digest Agent with Multi-MCP Integration

Demonstrates a real-world agent that combines multiple MCP servers to:
1. Fetch emails from the last 24h via Gmail MCP
2. Get top Hacker News posts via HN MCP
3. Create a structured Notion page with news, emails, and action items
4. On Thursday/Friday, add Stockholm restaurant recommendations via Search MCP

Prerequisites:
  - OPPER_API_KEY in .env
  - Composio MCP URLs in .env (see below)
  - pip install mcp

Required env variables:
  COMPOSIO_GMAIL_MCP_URL=...
  COMPOSIO_HACKERNEWS_MCP_URL=...
  COMPOSIO_NOTION_MCP_URL=...
  COMPOSIO_SEARCH_MCP_URL=...
  COMPOSIO_API_KEY=... (optional, for auth)

Run with:
  PYTHONPATH=src uv run python examples/agents/applied_agents/daily_digest_agent.py
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


class EmailSummary(BaseModel):
    sender: str = Field(description="Email sender")
    subject: str = Field(description="Email subject")
    summary: str = Field(description="Brief summary of the email content")
    action_required: bool = Field(description="Whether this email requires action")
    priority: str = Field(description="high, medium, or low")


class NewsItem(BaseModel):
    title: str = Field(description="News title")
    url: str | None = Field(default=None, description="Link to the article")
    points: int | None = Field(default=None, description="Number of points")
    summary: str = Field(description="Brief summary")
    relevance: str = Field(description="Why this might be interesting")


class ActionItem(BaseModel):
    action: str = Field(description="The action to take")
    source: str = Field(description="email, news, or other")
    link: str | None = Field(default=None, description="Related link if available")
    priority: str = Field(description="high, medium, or low")


class WeekendRecommendation(BaseModel):
    name: str = Field(description="Restaurant name")
    cuisine: str = Field(description="Type of cuisine")
    description: str = Field(description="Brief description")
    reason: str = Field(description="Why this is recommended")


class DailyDigest(BaseModel):
    date: str = Field(description="Date of the digest")
    emails: list[EmailSummary] = Field(description="Important emails from last 24h")
    news: list[NewsItem] = Field(description="Top news items from Hacker News")
    actions: list[ActionItem] = Field(description="Action items for today")
    weekend_recommendations: list[WeekendRecommendation] | None = Field(
        default=None, description="Weekend restaurant recommendations (Thu/Fri only)"
    )
    notion_page_created: bool = Field(description="Whether the Notion page was created")
    notion_page_url: str | None = Field(default=None, description="URL to the created Notion page")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_env_or_throw(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {key}\n"
            "Get your Composio MCP URLs from https://app.composio.dev/"
        )
    return value


def is_weekend_planning_day() -> bool:
    return datetime.now().weekday() in (3, 4)  # Thursday or Friday


def composio_mcp(name: str, env_key: str) -> MCPStreamableHTTPConfig:
    """Create a Composio MCP server config with optional auth."""
    api_key = os.environ.get("COMPOSIO_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
    return MCPStreamableHTTPConfig(
        name=name,
        url=get_env_or_throw(env_key),
        headers=headers,
    )


# ---------------------------------------------------------------------------
# MCP Servers
# ---------------------------------------------------------------------------

gmail_mcp = mcp(composio_mcp("composio-gmail", "COMPOSIO_GMAIL_MCP_URL"))
hackernews_mcp = mcp(composio_mcp("composio-hackernews", "COMPOSIO_HACKERNEWS_MCP_URL"))
notion_mcp = mcp(composio_mcp("composio-notion", "COMPOSIO_NOTION_MCP_URL"))
search_mcp = mcp(composio_mcp("composio-search", "COMPOSIO_SEARCH_MCP_URL"))

# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

today = datetime.now()
date_str = today.strftime("%Y-%m-%d")
day_name = today.strftime("%A")
is_weekend_prep = is_weekend_planning_day()

instructions = f"""
You are a personal productivity assistant that creates comprehensive daily digests.

Your workflow:
1. Fetch emails from the last 24 hours using Gmail tools
   - Focus on important/unread emails
   - Identify emails that require action
   - Summarize key content

2. Fetch top 10 Hacker News posts from the last day
   - Get the most upvoted posts
   - Summarize what makes them interesting

3. Generate action items based on emails and news
   - Extract actionable tasks from emails
   - Include relevant links

4. Create a Notion page titled "Daily Digest - {date_str}" with sections:
   - "Main News last 24h"
   - "Main Email last 24h"
   - "Actions for today"
"""

if is_weekend_prep:
    instructions += """
5. WEEKEND PLANNING (Thursday/Friday only):
   - Search for Stockholm restaurant recommendations
   - Focus on highly-rated restaurants with good reviews
   - Add a "Weekend Recommendations" section to the Notion page
"""

instructions += """
Guidelines:
- Be concise and actionable
- Prioritize important information
- Include links where relevant
"""

# Assemble tools — add search only on weekend planning days
tools: list = [gmail_mcp, hackernews_mcp, notion_mcp]
if is_weekend_prep:
    tools.append(search_mcp)

hooks = Hooks(
    on_iteration_start=lambda ctx: print(f"\n--- Iteration {ctx['iteration']} ---"),
    on_tool_start=lambda ctx: print(
        f"  -> {ctx['name']}({json.dumps(ctx['input'])[:120]}"
        f"{'...' if len(json.dumps(ctx['input'])) > 120 else ''})"
    ),
    on_tool_end=lambda ctx: (
        print(f"  x {ctx['name']} failed ({ctx['duration_ms']:.0f}ms): {ctx['error']}")
        if ctx.get("error")
        else print(
            f"  <- {ctx['name']} ({ctx['duration_ms']:.0f}ms): "
            f"{json.dumps(ctx['output'])[:150]}"
            f"{'...' if len(json.dumps(ctx['output'])) > 150 else ''}"
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
    name="daily-digest",
    instructions=instructions,
    output_schema=DailyDigest,
    model="anthropic/claude-sonnet-4-6",
    tools=tools,
    max_iterations=30,
    hooks=hooks,
)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


async def main() -> None:
    print("Daily Digest Agent")
    print("=" * 60)
    print(f"Date: {date_str} ({day_name})")
    if is_weekend_prep:
        print("Weekend planning mode: including restaurant recommendations")
    print("\nRunning...\n")

    prompt = f"Create my daily digest for {date_str} ({day_name})."
    if is_weekend_prep:
        prompt += " Include Stockholm restaurant recommendations for the weekend."

    try:
        result = await agent.run(prompt)

        digest = result.output
        print("=" * 60)
        print("DAILY DIGEST CREATED")
        print("=" * 60)
        print(f"\nDate: {digest.date}")
        print(f"Emails processed: {len(digest.emails)}")
        print(f"News items: {len(digest.news)}")
        print(f"Action items: {len(digest.actions)}")
        if digest.weekend_recommendations:
            print(f"Weekend recommendations: {len(digest.weekend_recommendations)}")
        if digest.notion_page_created:
            print(f"\nNotion page: {digest.notion_page_url or 'created'}")
        print(f"\nTokens used: {result.meta.usage.total_tokens}")
        print(f"Iterations: {result.meta.iterations}")
        print(f"Tool calls: {len(result.meta.tool_calls)}")

    except Exception as err:
        print(f"\nError: {err}")
        cause = getattr(err, "cause", None) or getattr(err, "__cause__", None)
        if cause:
            print(f"Cause: {cause}")
        print("\nTroubleshooting:")
        print("  - Verify Composio credentials are valid")
        print("  - Check MCP endpoint URLs in .env")
        print("  - Ensure OPPER_API_KEY is set")
        print("  - Verify connected apps in Composio (Gmail, Notion, etc.)")
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
