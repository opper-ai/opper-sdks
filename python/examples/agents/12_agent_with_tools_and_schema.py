# Agent with BOTH tools AND a structured output schema.
#
# Some providers (some routed through gemini/, vertexai/ Gemini 1.x,
# fireworks/, evroc/, etc.) don't accept a JSON-schema response format and
# a non-empty `tools` array in the same request. The Agent SDK detects
# this via a capability lookup and transparently injects a synthetic
# `final_answer` tool whose parameters are the requested output schema.
# The loop intercepts that call and returns the structured output.
#
# Three things make the fallback visible so you can verify it:
#   1. result.output is your typed Pydantic model either way.
#   2. result.meta.tool_calls contains a `final_answer` record on the
#      fallback path, in addition to the real tools the agent called.
#   3. The platform trace shows a `final_answer` span tagged
#      {"final_answer": True} under the agent root span.
#
# Try changing `model` between a whitelisted one (anthropic/claude-*,
# openai/gpt-*, vertexai/gemini-2+, gcp/gemini-2+) and a non-whitelisted
# one (fireworks/glm-5.1, evroc/moonshotai/Kimi-K2.6) to see both paths.
# You can also force a path with `structured_output_mode="tool"` /
# `"native"` if you want to compare without changing the model.

import asyncio
import json

from pydantic import BaseModel, Field

from opperai.agent import Agent, tool

# ── Tiny in-memory product DB the agent can query through tools ─────────────

PRODUCTS: dict[str, dict] = {
    "prod-001": {"name": "Wireless Headphones", "price": 79.99, "stock": 42},
    "prod-002": {"name": "Mechanical Keyboard", "price": 129.99, "stock": 15},
    "prod-003": {"name": "USB-C Hub", "price": 49.99, "stock": 0},
}


@tool
def lookup_product(product_id: str) -> dict:
    """Look up a product by its ID. Returns name, price, and stock."""
    product = PRODUCTS.get(product_id)
    if not product:
        return {"error": f"Product {product_id} not found"}
    return product


@tool
def check_availability(product_id: str, quantity: int) -> dict:
    """Check whether a product is available in the requested quantity."""
    product = PRODUCTS.get(product_id)
    if not product:
        return {"available": False, "reason": "Product not found"}
    if product["stock"] >= quantity:
        return {"available": True, "stock": product["stock"]}
    return {"available": False, "stock": product["stock"], "reason": "low stock"}


# ── Output schema: nested enough to exercise the fallback's $defs/$ref path ──


class LineItem(BaseModel):
    product_id: str
    name: str
    requested_quantity: int
    unit_price: float
    line_total: float
    available: bool


class OrderDecision(BaseModel):
    can_fulfill_in_full: bool
    items: list[LineItem]
    subtotal: float
    notes: str = Field(description="One-sentence summary of the decision.")


async def main() -> None:
    agent = Agent(
        name="order-checker",
        instructions=(
            "Use the available tools to look up each product the customer "
            "mentions and check whether the requested quantity is available. "
            "Then return a structured OrderDecision summarising the result."
        ),
        tools=[lookup_product, check_availability],
        output_schema=OrderDecision,
        # Capable model (native path). Switch to e.g. "fireworks/glm-5.1" or
        # "evroc/moonshotai/Kimi-K2.6" to see the synthetic-tool fallback
        # at work — same code, same result shape.
        model="anthropic/claude-haiku-4-5",
        # Or force one path explicitly:
        #   structured_output_mode="tool"    # always use final_answer fallback
        #   structured_output_mode="native"  # always send JSON-schema + tools
    )

    result = await agent.run(
        "Customer wants 5 units of prod-001 and 30 units of prod-002. "
        "Can we fulfill, and what's the subtotal?"
    )

    decision: OrderDecision = result.output
    print("Can fulfill in full:", decision.can_fulfill_in_full)
    print("Subtotal:", decision.subtotal)
    print("Notes:", decision.notes)
    print("\nLine items:")
    for item in decision.items:
        flag = "ok" if item.available else "short"
        print(
            f"  - {item.product_id} ({item.name}) "
            f"x{item.requested_quantity} = ${item.line_total:.2f} [{flag}]"
        )

    # Tool-call audit. On the fallback path, the last entry is the synthetic
    # `final_answer` call — its `input` and `output` carry the structured
    # decision the model committed to.
    print("\nTool calls made by the agent:")
    for call in result.meta.tool_calls:
        marker = " (final_answer)" if call.name == "final_answer" else ""
        body = json.dumps(call.input) if not isinstance(call.input, str) else call.input
        print(f"  - {call.name}{marker} <- {body[:100]}")

    print(f"\nIterations: {result.meta.iterations}")
    print(f"Tokens used: {result.meta.usage.total_tokens}")


if __name__ == "__main__":
    asyncio.run(main())
