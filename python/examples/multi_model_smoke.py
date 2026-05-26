#!/usr/bin/env python3
"""Multi-model smoke runner for the Agent SDK.

Runs three small scenarios against each model in ``MODELS`` and reports
per-(model, scenario) pass/fail. Each scenario exercises a different
combination of structured output and tools so the
structured-outputs-with-tools fallback is covered end-to-end:

  - ``schema_only``: ``output_schema`` set, no tools — native JSON schema.
  - ``tools_only``: tools set, no output schema — vanilla tool use.
  - ``schema_with_tools``: both — the case this file is here to exercise.
    For capable models this stays on the native path (JSON-schema response
    format + tools in one request). For models not in the capability
    whitelist the SDK transparently falls back to injecting a synthetic
    ``final_answer`` tool whose parameters are the requested schema.

Requires ``OPPER_API_KEY``. Run from ``python/``:

    uv run python examples/multi_model_smoke.py
    uv run python examples/multi_model_smoke.py --model openai/gpt-4o
    uv run python examples/multi_model_smoke.py --models openai/gpt-4o,anthropic/claude-haiku-4-5
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
import traceback
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from opperai.agent import Agent, tool
from opperai.agent._models import use_tool_fallback

# ---------------------------------------------------------------------------
# Models to exercise
# ---------------------------------------------------------------------------

# (model_id, expected_path_for_schema_with_tools)
# "native"   → model is in the SDK's structured-outputs-with-tools whitelist.
# "fallback" → SDK should transparently use the synthetic final_answer tool.
DEFAULT_MODELS: list[tuple[str, str]] = [
    ("openai/gpt-5.4", "native"),
    ("anthropic/claude-haiku-4-5", "native"),
    ("openai/gpt-5.5", "native"),
    ("vertexai/gemini-3.5-flash-eu", "native"),
    ("evroc/moonshotai/Kimi-K2.6", "fallback"),
    ("fireworks/glm-5.1", "fallback"),
]


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------


class Summary(BaseModel):
    title: str
    key_points: list[str]
    sentiment: str  # "positive" | "negative" | "neutral"


PRODUCTS: dict[str, dict[str, Any]] = {
    "prod-001": {"name": "Wireless Headphones", "price": 79.99, "stock": 42},
    "prod-002": {"name": "Mechanical Keyboard", "price": 129.99, "stock": 15},
}


@tool
def lookup_product(product_id: str) -> dict[str, Any]:
    """Look up a product by its ID. Returns name, price, and stock."""
    product = PRODUCTS.get(product_id)
    if not product:
        return {"error": f"Product {product_id} not found"}
    return product


@tool
def check_availability(product_id: str, quantity: int) -> dict[str, Any]:
    """Check whether a product is available in the requested quantity."""
    product = PRODUCTS.get(product_id)
    if not product:
        return {"available": False, "reason": "Product not found"}
    if product["stock"] >= quantity:
        return {"available": True, "stock": product["stock"]}
    return {"available": False, "stock": product["stock"], "reason": "low stock"}


class OrderDecision(BaseModel):
    """Structured decision for the schema+tools scenario.

    The agent must look up each requested product, check availability, and
    return this structured decision. The interesting bit: the model must
    coordinate tool calls AND deliver a typed final answer in one run.
    """

    can_fulfill: bool
    total_price: float
    notes: str


# Each scenario returns (description, async runner). Runners take a model.


async def scenario_schema_only(model: str) -> dict[str, Any]:
    agent = Agent(
        name="summarizer",
        instructions=(
            "You summarize text into structured form. Return a short title, "
            "key points, and overall sentiment (positive/negative/neutral)."
        ),
        output_schema=Summary,
        model=model,
        tracing=False,
    )
    result = await agent.run(
        "Python 3.12 brings major performance improvements with a new JIT compiler, "
        "better error messages, and improved typing support."
    )
    assert isinstance(result.output, Summary), f"output is {type(result.output)}"
    assert result.output.sentiment in {"positive", "negative", "neutral"}
    return {"iterations": result.meta.iterations, "tokens": result.meta.usage.total_tokens}


async def scenario_tools_only(model: str) -> dict[str, Any]:
    agent = Agent(
        name="shop-assistant",
        instructions=(
            "You are a shopping assistant. Use the available tools to look up "
            "products and check availability. Answer concisely."
        ),
        tools=[lookup_product, check_availability],
        model=model,
        tracing=False,
    )
    result = await agent.run(
        "What's the price of prod-001? Can I order 10 units of prod-002?"
    )
    assert isinstance(result.output, str) and result.output, "empty text output"
    assert any(c.name == "lookup_product" for c in result.meta.tool_calls), \
        "expected lookup_product to be called"
    return {
        "iterations": result.meta.iterations,
        "tool_calls": len(result.meta.tool_calls),
        "tokens": result.meta.usage.total_tokens,
    }


async def scenario_schema_with_tools(model: str) -> dict[str, Any]:
    """The key scenario: schema AND tools at the same time."""
    agent = Agent(
        name="order-checker",
        instructions=(
            "Use the tools to look up each product mentioned and check whether "
            "the customer's order can be fulfilled. Then return a structured "
            "decision summarising what you found."
        ),
        tools=[lookup_product, check_availability],
        output_schema=OrderDecision,
        model=model,
        tracing=False,
    )
    result = await agent.run(
        "Customer wants 5 units of prod-001 and 30 units of prod-002. "
        "Can we fulfill and what's the total price?"
    )
    assert isinstance(result.output, OrderDecision), \
        f"expected OrderDecision, got {type(result.output).__name__}: {result.output!r}"
    return {
        "iterations": result.meta.iterations,
        "tool_calls": len(result.meta.tool_calls),
        "tokens": result.meta.usage.total_tokens,
        "decision": {
            "can_fulfill": result.output.can_fulfill,
            "total_price": result.output.total_price,
        },
    }


# ---------------------------------------------------------------------------
# Complex-schema scenario — nested models, list-of-nested, enum, optionals.
# Exercises ($defs/$ref inlining) + the fallback's final_answer parameters
# round-trip against a non-trivial schema.
# ---------------------------------------------------------------------------


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class LineItem(BaseModel):
    product_id: str
    product_name: str
    requested_quantity: int
    available_quantity: int
    unit_price: float
    line_total: float
    backorder: bool = Field(
        description="True if requested_quantity exceeds available stock."
    )


class FulfillmentPlan(BaseModel):
    """Top-level structured decision the agent must produce.

    Combines nested objects, a list-of-nested, an enum, and an optional
    field — the shape providers most often choke on when JSON-schema +
    tools are sent in one request, or when the fallback has to deliver it
    via a tool's parameters block.
    """

    can_fulfill_in_full: bool
    items: list[LineItem]
    subtotal: float
    risk: RiskLevel
    alternate_suggestion: str | None = Field(
        default=None,
        description=(
            "If the order can't be fulfilled in full, suggest an alternative "
            "(e.g. partial shipment). Null when can_fulfill_in_full is true."
        ),
    )
    notes: str


async def scenario_schema_with_tools_complex(model: str) -> dict[str, Any]:
    """The hardest scenario: tools + a non-trivial nested schema."""
    agent = Agent(
        name="fulfillment-planner",
        instructions=(
            "You are an order-fulfillment planner. Use the tools to look up "
            "each product's price and stock, then return a complete fulfillment "
            "plan as a structured FulfillmentPlan. Set `backorder` per line, "
            "compute line_total = requested_quantity * unit_price, sum into "
            "subtotal, set risk to high when any line is on backorder, medium "
            "when stock is tight (<= 5 units headroom), low otherwise. Only "
            "set alternate_suggestion when can_fulfill_in_full is false."
        ),
        tools=[lookup_product, check_availability],
        output_schema=FulfillmentPlan,
        model=model,
        tracing=False,
        max_iterations=15,
    )
    result = await agent.run(
        "Plan fulfillment for 3 units of prod-001 and 30 units of prod-002."
    )
    plan = result.output
    assert isinstance(plan, FulfillmentPlan), \
        f"expected FulfillmentPlan, got {type(plan).__name__}: {plan!r}"

    # Structural assertions — the model must populate the nested shape, not
    # just emit a plausible-looking string.
    assert len(plan.items) >= 2, f"expected >=2 line items, got {len(plan.items)}"
    assert plan.risk in {RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH}
    for item in plan.items:
        assert isinstance(item, LineItem), f"item is {type(item).__name__}"
        assert item.product_id, "missing product_id"
        # line_total must be consistent with unit_price * quantity (loose
        # tolerance — some models round)
        expected = item.requested_quantity * item.unit_price
        assert abs(item.line_total - expected) < 0.5, \
            f"line_total {item.line_total} != qty*price {expected}"

    return {
        "iterations": result.meta.iterations,
        "tool_calls": len(result.meta.tool_calls),
        "tokens": result.meta.usage.total_tokens,
        "items": len(plan.items),
        "risk": plan.risk.value,
        "can_fulfill": plan.can_fulfill_in_full,
    }


SCENARIOS: list[tuple[str, Any]] = [
    ("schema_only", scenario_schema_only),
    ("tools_only", scenario_tools_only),
    ("schema_with_tools", scenario_schema_with_tools),
    ("schema_with_tools_complex", scenario_schema_with_tools_complex),
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def _color(s: str, code: str) -> str:
    return f"\033[{code}m{s}\033[0m"


async def run_one(model: str, scenario_name: str, runner: Any) -> dict[str, Any]:
    start = time.monotonic()
    try:
        info = await asyncio.wait_for(runner(model), timeout=120)
        ms = int((time.monotonic() - start) * 1000)
        return {"status": "PASS", "ms": ms, **info}
    except asyncio.TimeoutError:
        ms = int((time.monotonic() - start) * 1000)
        return {"status": "TIMEOUT", "ms": ms, "error": "exceeded 120s"}
    except AssertionError as exc:
        ms = int((time.monotonic() - start) * 1000)
        return {"status": "ASSERT", "ms": ms, "error": str(exc) or repr(exc)}
    except Exception as exc:
        ms = int((time.monotonic() - start) * 1000)
        tb = traceback.format_exc(limit=2).strip().splitlines()
        return {"status": "ERROR", "ms": ms, "error": f"{type(exc).__name__}: {exc}", "trace": tb[-1] if tb else ""}


async def run_for_model(model: str, expected_path: str) -> list[dict[str, Any]]:
    print(_color(f"\n=== {model}  [{expected_path}] ===", "1;36"))

    # Print what the SDK *thinks* about this model so a mismatch with the
    # expected_path label is obvious in the report.
    sdk_decision = (
        "fallback"
        if use_tool_fallback(model, has_tools=True, has_output_schema=True, mode=None)
        else "native"
    )
    if sdk_decision != expected_path:
        print(_color(
            f"  ! SDK capability lookup says {sdk_decision!r} but expected {expected_path!r}",
            "33",
        ))
    else:
        print(f"  capability lookup → {sdk_decision}")

    results: list[dict[str, Any]] = []
    for name, runner in SCENARIOS:
        sys.stdout.write(f"  {name:24s} ... ")
        sys.stdout.flush()
        result = await run_one(model, name, runner)
        status = result["status"]
        ms = result["ms"]
        color = {"PASS": "32", "TIMEOUT": "33", "ASSERT": "31", "ERROR": "31"}[status]
        print(_color(f"{status} ({ms}ms)", color))
        if status != "PASS":
            print(f"    {result.get('error', '')}")
            if result.get("trace"):
                print(f"    {result['trace']}")
        results.append({"model": model, "scenario": name, **result})
    return results


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", help="Run for a single model id")
    parser.add_argument("--models", help="Comma-separated model ids")
    args = parser.parse_args()

    if not os.environ.get("OPPER_API_KEY"):
        # Try loading from .env at repo root if present (matches existing examples' pattern)
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(env_path):
            for line in open(env_path):
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.strip().partition("=")
                    os.environ.setdefault(k, v.strip().strip('"').strip("'"))

    if not os.environ.get("OPPER_API_KEY"):
        print("Error: OPPER_API_KEY is not set.", file=sys.stderr)
        return 1

    if args.model:
        # Single explicit model — assume the user knows the path they want.
        targets = [(args.model, "native" if not use_tool_fallback(args.model, True, True, None) else "fallback")]
    elif args.models:
        targets = [
            (m.strip(), "native" if not use_tool_fallback(m.strip(), True, True, None) else "fallback")
            for m in args.models.split(",")
            if m.strip()
        ]
    else:
        targets = DEFAULT_MODELS

    all_results: list[dict[str, Any]] = []
    for model, expected in targets:
        all_results.extend(await run_for_model(model, expected))

    # Compact summary table at the end.
    print(_color("\n=== Summary ===", "1;36"))
    by_model: dict[str, dict[str, str]] = {}
    for r in all_results:
        by_model.setdefault(r["model"], {})[r["scenario"]] = r["status"]

    scenario_names = [name for name, _ in SCENARIOS]
    col_widths = [max(len(n), 6) for n in scenario_names]
    header_parts = [f"{n:{w}s}" for n, w in zip(scenario_names, col_widths)]
    header = f"{'model':40s} | " + " | ".join(header_parts)
    print(header)
    print("-" * len(header))
    for model in [m for m, _ in targets]:
        row = by_model.get(model, {})
        cells = [f"{row.get(n, '-'):{w}s}" for n, w in zip(scenario_names, col_widths)]
        print(f"{model:40s} | " + " | ".join(cells))

    failures = sum(1 for r in all_results if r["status"] != "PASS")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
