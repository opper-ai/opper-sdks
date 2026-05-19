# Agent with reasoning_effort and reasoning_summary (added in 2.0.0b12).
#
# Both fields are accepted on Agent construction and on per-run RunOptions.
# Per-run kwargs win over the agent's defaults.

import asyncio

from opperai.agent import Agent


async def main() -> None:
    agent = Agent(
        name="reasoning-agent",
        instructions="You are a careful thinker. Show your work step by step.",
        model="openai/gpt-5.1",
        reasoning_effort="low",
        reasoning_summary="auto",
    )

    result = await agent.run(
        "A bat and a ball cost $1.10. The bat costs $1.00 more than the ball. "
        "How much does the ball cost?"
    )

    print("Output:", result.output)
    print("Reasoning tokens:", result.meta.usage.reasoning_tokens)

    # ── Override at run-time ────────────────────────────────────────────────
    overridden = await agent.run(
        "What is 17 * 24? Just give the number.",
        reasoning_effort="medium",
    )
    print("\nOverridden output:", overridden.output)


if __name__ == "__main__":
    asyncio.run(main())
