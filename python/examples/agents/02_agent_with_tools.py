# Agent with tools — the loop executes tool calls automatically until done

import asyncio
import json

from opperai.agent import Agent, tool

# Simulated database of products
PRODUCTS = {
    "prod-001": {"name": "Wireless Headphones", "price": 79.99, "stock": 42},
    "prod-002": {"name": "Mechanical Keyboard", "price": 129.99, "stock": 15},
    "prod-003": {"name": "USB-C Hub", "price": 49.99, "stock": 0},
}


@tool
def lookup_product(product_id: str) -> dict:
    """Look up a product by its ID to get name, price, and stock level."""
    product = PRODUCTS.get(product_id)
    if not product:
        return {"error": f"Product {product_id} not found"}
    return product


@tool
def check_availability(product_id: str, quantity: int) -> dict:
    """Check if a product is available for purchase."""
    product = PRODUCTS.get(product_id)
    if not product:
        return {"available": False, "reason": "Product not found"}
    if product["stock"] >= quantity:
        return {"available": True, "stock": product["stock"]}
    return {
        "available": False,
        "reason": f"Only {product['stock']} units in stock",
        "stock": product["stock"],
    }


async def main() -> None:
    agent = Agent(
        name="shop-assistant",
        instructions=(
            "You are a helpful shopping assistant. Use the available tools "
            "to look up products and check availability. Be concise."
        ),
        tools=[lookup_product, check_availability],
    )

    result = await agent.run(
        "Can I order 10 units of prod-002? Also, what's the price of prod-001?"
    )

    print("Answer:", result.output)
    print("\nTool calls made:")
    for call in result.meta.tool_calls:
        print(
            f"  - {call.name}({json.dumps(call.input)}) -> "
            f"{json.dumps(call.output)} ({call.duration_ms:.0f}ms)"
        )
    print(f"\nIterations: {result.meta.iterations}")
    print(f"Tokens used: {result.meta.usage.total_tokens}")


if __name__ == "__main__":
    asyncio.run(main())
