# Agent as tool — wrap a specialist agent so another agent can call it
# as_tool() is the building block for multi-agent composition.

import asyncio

from opperai.agent import Agent


async def main() -> None:
    # A specialist agent that only knows about geography
    geographer = Agent(
        name="geographer",
        instructions=(
            "You are a geography expert. Answer geography questions precisely "
            "and concisely. Include key facts like population, area, or notable "
            "features when relevant."
        ),
    )

    # A coordinator agent that delegates geography questions to the specialist
    coordinator = Agent(
        name="coordinator",
        instructions=(
            "You are a helpful assistant. When the user asks a geography question, "
            "use the geography_expert tool to get an authoritative answer, then "
            "present it in a friendly way. For non-geography questions, answer directly."
        ),
        tools=[
            geographer.as_tool(
                name="geography_expert",
                description="Ask a geography expert a question. Pass the full question as input.",
            ),
        ],
    )

    result = await coordinator.run("What are the three largest countries by area?")

    print("Answer:", result.output)
    print(f"\nCoordinator iterations: {result.meta.iterations}")
    print(f"Coordinator tokens: {result.meta.usage.total_tokens}")

    # The sub-agent's result is captured in the tool call output
    sub_call = next(
        (c for c in result.meta.tool_calls if c.name == "geography_expert"), None
    )
    if sub_call and isinstance(sub_call.output, dict):
        print(f"\nSub-agent output: {sub_call.output.get('output', '')}")
        print(f"Sub-agent iterations: {sub_call.output.get('iterations', 0)}")


if __name__ == "__main__":
    asyncio.run(main())
