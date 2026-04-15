# Hooks — observe every lifecycle event during an agent run
# Hooks let you log, trace, or measure without touching the agent logic.

import asyncio
import json

from opperai.agent import Agent, Hooks, tool


@tool
def lookup_city(city: str) -> dict:
    """Get facts about a city."""
    return {
        "city": city,
        "population": "2.1M" if city == "Paris" else "13.9M",
        "country": "France" if city == "Paris" else "Japan",
    }


hooks = Hooks(
    on_agent_start=lambda ctx: print(
        f'\nAgent "{ctx["agent"]}" started with input: {ctx["input"]}'
    ),
    on_agent_end=lambda ctx: (
        print(
            f'\nAgent "{ctx["agent"]}" completed in '
            f'{ctx["result"].meta.iterations} iteration(s)'
        )
        if ctx.get("result")
        else print(f'\nAgent "{ctx["agent"]}" failed: {ctx.get("error")}')
    ),
    on_iteration_start=lambda ctx: print(f'\n--- Iteration {ctx["iteration"]} ---'),
    on_llm_call=lambda ctx: print(
        f'  Sending request to LLM (iteration {ctx["iteration"]})'
    ),
    on_llm_response=lambda ctx: print(
        f'  Got response '
        f'({ctx["response"].get("usage", {}).get("total_tokens", "?")} tokens)'
    ),
    on_tool_start=lambda ctx: print(
        f'  Tool "{ctx["name"]}" called with: {json.dumps(ctx["input"])}'
    ),
    on_tool_end=lambda ctx: (
        print(
            f'  Tool "{ctx["name"]}" returned: '
            f'{json.dumps(ctx["output"])} ({ctx["duration_ms"]:.0f}ms)'
        )
        if not ctx.get("error")
        else print(
            f'  Tool "{ctx["name"]}" failed: '
            f'{ctx["error"]} ({ctx["duration_ms"]:.0f}ms)'
        )
    ),
)


async def main() -> None:
    agent = Agent(
        name="city-expert",
        instructions=(
            "You answer questions about cities. "
            "Use the lookup_city tool to get facts. Be concise."
        ),
        tools=[lookup_city],
        hooks=hooks,
    )

    result = await agent.run("Compare Paris and Tokyo - which is bigger?")
    print("\nFinal answer:", result.output)


if __name__ == "__main__":
    asyncio.run(main())
