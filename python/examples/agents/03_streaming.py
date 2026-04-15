# Streaming — observe the agent's work as it happens

import asyncio
import json
import sys

from opperai.agent import Agent, tool


@tool
def get_weather(city: str) -> dict:
    """Get the current weather for a city."""
    import random

    return {
        "city": city,
        "temperature": round(15 + random.random() * 15),
        "condition": random.choice(["sunny", "cloudy", "rainy"]),
    }


async def main() -> None:
    agent = Agent(
        name="weather-assistant",
        instructions="You help users check the weather. Be concise.",
        tools=[get_weather],
    )

    # Pattern 1: Iterate events for live output
    print("--- Streaming events ---")
    stream = agent.stream("What's the weather in Paris and Tokyo?")

    async for event in stream:
        match event.type:
            case "iteration_start":
                print(f"\n[Iteration {event.iteration}]")
            case "text_delta":
                sys.stdout.write(event.text)
                sys.stdout.flush()
            case "tool_start":
                print(f"  -> Calling {event.name}({json.dumps(event.input)})")
            case "tool_end":
                print(
                    f"  <- {event.name} returned: "
                    f"{json.dumps(event.output)} ({event.duration_ms:.0f}ms)"
                )

    # Pattern 2: Get the final result after streaming
    result = await stream.result()
    print("\n\n--- Final result ---")
    print("Output:", result.output)
    print("Iterations:", result.meta.iterations)
    print("Tool calls:", len(result.meta.tool_calls))
    print("Tokens:", result.meta.usage.total_tokens)


if __name__ == "__main__":
    asyncio.run(main())
