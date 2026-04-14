# Hooks for timing — measure LLM latency and tool execution time

import asyncio
import time

from opperai.agent import Agent, Hooks, tool


@tool
def slow_lookup(query: str) -> str:
    """Simulate a slow database lookup."""
    time.sleep(0.1)  # Simulate latency
    return f"Results for: {query}"


# Collect metrics using closure state
metrics: dict = {
    "llm_calls": 0,
    "llm_total_ms": 0,
    "tool_total_ms": 0,
    "tools_called": 0,
}
_llm_start: dict = {}


def on_llm_call(ctx: dict) -> None:
    _llm_start[ctx["iteration"]] = time.monotonic()


def on_llm_response(ctx: dict) -> None:
    start = _llm_start.pop(ctx["iteration"], None)
    if start:
        elapsed_ms = (time.monotonic() - start) * 1000
        metrics["llm_calls"] += 1
        metrics["llm_total_ms"] += elapsed_ms
        print(f"  LLM call #{metrics['llm_calls']}: {elapsed_ms:.0f}ms")


def on_tool_end(ctx: dict) -> None:
    metrics["tools_called"] += 1
    metrics["tool_total_ms"] += ctx["duration_ms"]
    print(f"  Tool {ctx['name']}: {ctx['duration_ms']:.0f}ms")


async def main() -> None:
    hooks = Hooks(
        on_llm_call=on_llm_call,
        on_llm_response=on_llm_response,
        on_tool_end=on_tool_end,
    )

    agent = Agent(
        name="timed-agent",
        instructions="You help with lookups. Be concise.",
        tools=[slow_lookup],
        hooks=hooks,
    )

    result = await agent.run("Look up 'machine learning' and 'deep learning'")

    print("\n--- Performance Summary ---")
    print(
        f"LLM calls: {metrics['llm_calls']} ({metrics['llm_total_ms']:.0f}ms total)"
    )
    print(
        f"Tool calls: {metrics['tools_called']} ({metrics['tool_total_ms']:.0f}ms total)"
    )
    print(f"Tokens: {result.meta.usage.total_tokens}")


if __name__ == "__main__":
    asyncio.run(main())
