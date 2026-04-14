# Your first agent — a simple agentic loop with no tools
# The Agent class handles the loop: it calls the model, collects the response,
# and returns when the model produces a final answer.

import asyncio

from opperai.agent import Agent


async def main() -> None:
    agent = Agent(
        name="my-first-agent",
        instructions="You are a helpful assistant. Answer concisely.",
    )

    result = await agent.run("What is the capital of France, and what is it famous for?")

    print("Output:", result.output)
    print("Iterations:", result.meta.iterations)
    print("Tokens used:", result.meta.usage.total_tokens)


if __name__ == "__main__":
    asyncio.run(main())
