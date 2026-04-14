# Streaming with hooks — both patterns compose naturally.
# Hooks fire alongside stream events without interfering.

import asyncio
import sys

from opperai.agent import Agent, Hooks, tool


@tool
def get_fact(topic: str) -> str:
    """Get an interesting fact about a topic."""
    facts = {
        "python": "Python was named after Monty Python's Flying Circus.",
        "rust": "Rust has been the most loved language on Stack Overflow for 8 years.",
    }
    return facts.get(topic.lower(), f"No fact available for {topic}")


hooks = Hooks(
    on_iteration_start=lambda ctx: print(
        f"\n[Hook] Iteration {ctx['iteration']} started"
    ),
    on_tool_start=lambda ctx: print(f"[Hook] Tool '{ctx['name']}' starting..."),
    on_tool_end=lambda ctx: print(
        f"[Hook] Tool '{ctx['name']}' done ({ctx['duration_ms']:.0f}ms)"
    ),
    on_agent_end=lambda ctx: print(
        f"\n[Hook] Agent done in {ctx['result'].meta.iterations} iteration(s)"
    )
    if ctx.get("result")
    else None,
)


async def main() -> None:
    agent = Agent(
        name="fact-bot",
        instructions="You share interesting facts. Be concise.",
        tools=[get_fact],
        hooks=hooks,
    )

    print("--- Streaming with hooks ---")
    stream = agent.stream("Tell me a fun fact about Python and Rust")

    async for event in stream:
        if event.type == "text_delta":
            sys.stdout.write(event.text)
            sys.stdout.flush()

    result = await stream.result()
    print(f"\nTokens: {result.meta.usage.total_tokens}")


if __name__ == "__main__":
    asyncio.run(main())
