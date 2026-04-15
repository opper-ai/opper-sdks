# Agent with structured output — Pydantic model as output_schema
# The agent returns validated, typed data instead of free text.

import asyncio

from pydantic import BaseModel

from opperai.agent import Agent


class Summary(BaseModel):
    title: str
    key_points: list[str]
    sentiment: str  # "positive", "negative", or "neutral"


async def main() -> None:
    agent = Agent(
        name="summarizer",
        instructions=(
            "You summarize text into structured form. "
            "Return a title, key points, and overall sentiment (positive/negative/neutral)."
        ),
        output_schema=Summary,
    )

    result = await agent.run(
        "Python 3.12 brings major performance improvements with a new JIT compiler, "
        "better error messages, and improved typing support. The community response "
        "has been overwhelmingly positive, with many developers praising the faster "
        "execution speeds and more helpful debugging experience."
    )

    # result.output is a validated Summary instance
    summary = result.output
    print(f"Title: {summary.title}")
    print(f"Sentiment: {summary.sentiment}")
    print("Key points:")
    for point in summary.key_points:
        print(f"  - {point}")
    print(f"\nTokens: {result.meta.usage.total_tokens}")


if __name__ == "__main__":
    asyncio.run(main())
