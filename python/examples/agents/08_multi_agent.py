# Multi-agent — coordinator delegates to specialist agents
# Shows a three-agent editorial pipeline: researcher -> writer -> coordinator.

import asyncio

from opperai.agent import Agent, Hooks, tool

# --- Specialist: Researcher ---


@tool
def market_data(sector: str) -> dict:
    """Get market data for a sector."""
    data = {
        "ai": {
            "growth": "34% YoY",
            "market_size": "$200B",
            "key_players": ["OpenAI", "Anthropic", "Google"],
        },
        "cloud": {
            "growth": "22% YoY",
            "market_size": "$600B",
            "key_players": ["AWS", "Azure", "GCP"],
        },
    }
    return data.get(sector.lower(), {"error": f"No data for sector: {sector}"})


@tool
def audience_insights(demographic: str) -> dict:
    """Get audience insights for a demographic."""
    return {
        "demographic": demographic,
        "preferred_format": "short-form with bullet points",
        "attention_span": "2-3 minutes",
    }


researcher = Agent(
    name="researcher",
    instructions=(
        "You research topics using market data and audience insights. "
        "Be thorough but concise."
    ),
    tools=[market_data, audience_insights],
)

# --- Specialist: Writer ---


@tool
def style_guide(content_type: str) -> dict:
    """Get style guidelines for a content type."""
    return {
        "content_type": content_type,
        "tone": "professional yet accessible",
        "max_length": "300 words",
        "structure": "headline, summary, 3 key points, takeaway",
    }


writer = Agent(
    name="writer",
    instructions="You write clear, engaging content following the style guide. Be concise.",
    tools=[style_guide],
)

# --- Coordinator ---

hooks = Hooks(
    on_tool_start=lambda ctx: print(f"  Delegating to: {ctx['name']}"),
    on_tool_end=lambda ctx: print(f"  {ctx['name']} done ({ctx['duration_ms']:.0f}ms)"),
)

coordinator = Agent(
    name="editorial-coordinator",
    instructions=(
        "You coordinate editorial work. For content requests:\n"
        "1. Use the researcher to gather data and audience insights\n"
        "2. Use the writer to create the final piece\n"
        "Present the writer's output as the final answer."
    ),
    tools=[
        researcher.as_tool(
            name="researcher",
            description="Research a topic. Returns market data and audience insights.",
        ),
        writer.as_tool(
            name="writer",
            description="Write content based on research. Pass the research findings as input.",
        ),
    ],
    hooks=hooks,
)


async def main() -> None:
    print("Running editorial pipeline...\n")
    result = await coordinator.run(
        "Write a brief newsletter piece about the AI sector for tech executives"
    )

    print(f"\n{'='*60}")
    print(result.output)
    print(f"{'='*60}")
    print(f"\nTotal iterations: {result.meta.iterations}")
    print(f"Total tokens: {result.meta.usage.total_tokens}")
    print(f"Tool calls: {len(result.meta.tool_calls)}")


if __name__ == "__main__":
    asyncio.run(main())
