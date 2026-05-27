"""
Daily Digest Agent — direct API tools, no MCP middleware.

Builds a daily digest by:
1. Fetching the top Hacker News posts (free, no auth).
2. Searching the web for restaurant recommendations via Jina AI's search API.
3. Writing the result as a structured Notion page with action items.

This example shows the opperai Agent loop driving plain ``@tool`` functions
against three small public APIs — no MCP server, no third-party tool broker.

Prerequisites:
  - OPPER_API_KEY in .env
  - JINA_API_KEY in .env (https://jina.ai/?sui=apikey)
  - NOTION_TOKEN in .env (notion.so/profile/integrations, "Internal" integration)
  - NOTION_PARENT_PAGE_ID in .env — a Notion page ID where the digest will be
    created as a child. Share that page with your integration first
    (Notion → page → Share → add the integration).

Run with:
  PYTHONPATH=src uv run python examples/agents/applied_agents/daily_digest_agent.py
"""

import asyncio
import json
import os
from datetime import datetime
from typing import Any

import httpx
from pydantic import BaseModel, Field

from opperai.agent import Agent, Hooks, tool

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class NewsItem(BaseModel):
    title: str = Field(description="News title")
    url: str | None = Field(default=None, description="Link to the article")
    points: int | None = Field(default=None, description="Number of points / upvotes")
    summary: str = Field(description="Brief summary or commentary on the story")


class RestaurantPick(BaseModel):
    name: str = Field(description="Restaurant name")
    location: str = Field(description="City and neighbourhood")
    cuisine: str = Field(description="Type of cuisine")
    reason: str = Field(description="Why it is worth a visit")
    url: str | None = Field(default=None, description="Source URL with more info")


class ActionItem(BaseModel):
    action: str = Field(description="The action to take")
    source: str = Field(description="news or restaurant")
    link: str | None = Field(default=None, description="Related link if available")


class DailyDigest(BaseModel):
    date: str = Field(description="Date of the digest, ISO 8601 (YYYY-MM-DD)")
    news: list[NewsItem] = Field(description="Top news items from Hacker News")
    restaurants: list[RestaurantPick] = Field(description="Restaurants worth trying")
    actions: list[ActionItem] = Field(description="Action items derived from the digest")
    notion_page_url: str = Field(description="URL of the created Notion page")


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


HN_BASE = "https://hacker-news.firebaseio.com/v0"


@tool
async def fetch_hn_top_stories(limit: int = 10) -> list[dict[str, Any]]:
    """Fetch the top stories currently on Hacker News.

    Returns a list of stories with id, title, url, score (upvotes), author,
    and descendants (comment count).
    """
    capped = max(1, min(limit, 30))
    async with httpx.AsyncClient(timeout=15) as client:
        ids_resp = await client.get(f"{HN_BASE}/topstories.json")
        ids_resp.raise_for_status()
        story_ids: list[int] = ids_resp.json()[:capped]

        async def fetch_item(sid: int) -> dict[str, Any]:
            r = await client.get(f"{HN_BASE}/item/{sid}.json")
            r.raise_for_status()
            return r.json() or {}

        items = await asyncio.gather(*(fetch_item(sid) for sid in story_ids))

    return [
        {
            "id": it.get("id"),
            "title": it.get("title"),
            "url": it.get("url"),
            "score": it.get("score"),
            "by": it.get("by"),
            "descendants": it.get("descendants"),
        }
        for it in items
    ]


@tool
async def search_web(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search the web with Jina AI's search API.

    Pass a natural-language query (for example
    'best ramen restaurants in Stockholm 2026'). Returns a list of
    {title, url, description} results.
    """
    api_key = os.environ["JINA_API_KEY"]
    cap = max(1, min(max_results, 10))
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://s.jina.ai/{query}",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
                "X-Respond-With": "no-content",
            },
        )
        resp.raise_for_status()
        data = resp.json().get("data", []) or []

    return [
        {
            "title": item.get("title"),
            "url": item.get("url"),
            "description": item.get("description") or item.get("content") or "",
        }
        for item in data[:cap]
    ]


@tool
async def create_notion_page(title: str, sections: list[dict[str, str]]) -> str:
    """Create a Notion page as a child of NOTION_PARENT_PAGE_ID.

    ``sections`` is a list of ``{"heading": str, "body": str}`` entries.
    Each section is rendered as a heading_2 block followed by a paragraph
    block. Returns the URL of the created page.
    """
    token = os.environ["NOTION_TOKEN"]
    parent_id = os.environ["NOTION_PARENT_PAGE_ID"]

    children: list[dict[str, Any]] = []
    for section in sections:
        heading = (section.get("heading") or "").strip()
        body = (section.get("body") or "").strip()
        if heading:
            children.append(
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {
                        "rich_text": [{"type": "text", "text": {"content": heading}}]
                    },
                }
            )
        if body:
            # Notion caps text blocks at ~2000 chars; split conservatively.
            for chunk in [body[i : i + 1900] for i in range(0, len(body), 1900)] or [""]:
                children.append(
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": chunk}}]
                        },
                    }
                )

    payload = {
        "parent": {"page_id": parent_id},
        "properties": {
            "title": {"title": [{"type": "text", "text": {"content": title}}]}
        },
        "children": children,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.notion.com/v1/pages",
            headers={
                "Authorization": f"Bearer {token}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        return resp.json().get("url", "")


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

today = datetime.now()
date_str = today.strftime("%Y-%m-%d")
day_name = today.strftime("%A")

instructions = f"""
You are a personal productivity assistant that produces a daily digest.

Workflow for {date_str} ({day_name}):
1. Fetch the top Hacker News posts (use fetch_hn_top_stories).
   - Pick the most interesting 5-7.
   - Summarize what makes each one notable.

2. Search the web for restaurant recommendations (use search_web).
   - Aim for highly-rated restaurants in Stockholm with recent reviews.
   - Pick 3-5 worth trying this weekend.

3. Derive 2-4 action items from the news and restaurants.

4. Create a Notion page titled "Daily Digest - {date_str}" (use
   create_notion_page) with sections:
   - "Top News"
   - "Restaurant Picks"
   - "Actions"
   Render each section's body as concise plain text — one line per item with
   the title and link.

Be concise. Always include source URLs. Iterate through every step; do not
return an empty digest.
"""

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
    tools=[fetch_hn_top_stories, search_web, create_notion_page],
    max_iterations=15,
    hooks=hooks,
)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


async def main() -> None:
    for key in ("OPPER_API_KEY", "JINA_API_KEY", "NOTION_TOKEN", "NOTION_PARENT_PAGE_ID"):
        if not os.environ.get(key):
            raise SystemExit(
                f"Missing required env var: {key}\n"
                "See the docstring at the top of this file for setup steps."
            )

    print("Daily Digest Agent")
    print("=" * 60)
    print(f"Date: {date_str} ({day_name})\n")
    print("Running...\n")

    try:
        result = await agent.run(
            f"Create my daily digest for {date_str} ({day_name})."
        )
        digest = result.output
        print("=" * 60)
        print("DAILY DIGEST CREATED")
        print("=" * 60)
        print(f"\nDate: {digest.date}")
        print(f"News items: {len(digest.news)}")
        print(f"Restaurants: {len(digest.restaurants)}")
        print(f"Actions: {len(digest.actions)}")
        print(f"\nNotion page: {digest.notion_page_url}")
        print(f"Tokens used: {result.meta.usage.total_tokens}")
        print(f"Iterations: {result.meta.iterations}")
        print(f"Tool calls: {len(result.meta.tool_calls)}")
    except Exception as err:
        print(f"\nError: {err}")
        cause = getattr(err, "cause", None) or getattr(err, "__cause__", None)
        if cause:
            print(f"Cause: {cause}")
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
