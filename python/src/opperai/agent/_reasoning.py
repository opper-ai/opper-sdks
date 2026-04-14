"""Agent SDK — Reasoning extraction helpers."""

from __future__ import annotations

from typing import Any


def extract_reasoning(output_items: list[dict[str, Any]]) -> str | None:
    """Extract reasoning text from response output items."""
    for item in output_items:
        if item.get("type") == "reasoning" and item.get("summary"):
            parts = item["summary"]
            text = "".join(part.get("text", "") for part in parts)
            if text:
                return text
    return None


def accumulate_reasoning(collected: list[str], text: str) -> None:
    """Append reasoning text to the collected list."""
    collected.append(text)
