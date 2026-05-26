"""Model capability lookup for the structured-outputs-with-tools fallback.

Some providers / models routed through Opper do not accept a JSON-schema
response format and a non-empty ``tools`` array in the same request. For
those, the agent loop falls back to a synthetic ``final_answer`` tool whose
``parameters`` is the requested ``output_schema``; the model returns its
structured answer by calling that tool.

This module is the lookup that decides which path to take. The whitelist is
intentionally narrow: when in doubt, prefer the fallback (it works
everywhere) over sending a request that errors out at the provider.
"""

from __future__ import annotations

from typing import Literal

from ..types import Model

StructuredOutputMode = Literal["auto", "native", "tool"]


# Prefix patterns for models known to support structured outputs (JSON schema
# response format) AND a non-empty tools array in the same request.
#
# Sourced from each provider's public docs:
#   - OpenAI: gpt-4o family, gpt-4.1, gpt-5, o-series — structured outputs +
#     tools are both first-class on the Responses API.
#   - Anthropic: Claude 3.5+ and Claude 4 support tool_use; we constrain the
#     response shape via a `final_answer`-style pattern in their docs, but
#     when routed through Opper's gateway the JSON-schema format is honored
#     at the gateway layer for these model families.
#   - Google Gemini 2.x / 3.x: response_schema + function_declarations
#     coexist; 1.x did not.
#
# Add new entries here as providers' capabilities expand.
_SUPPORTS_STRUCTURED_TOOLS: tuple[str, ...] = (
    "openai/",
    "azure/openai/",
    "anthropic/",
    "gcp/gemini-2.",
    "gcp/gemini-3.",
    "google/gemini-2.",
    "google/gemini-3.",
    "vertexai/gemini-2.",
    "vertexai/gemini-3.",
)


def _model_name(model: Model | None) -> str | None:
    """Extract a single model identifier from the polymorphic ``Model`` type.

    For a fallback chain (list), use the first entry — that's what the
    gateway will try first, and the fallback decision is per-request. If the
    chain crosses a capability boundary the user should set
    ``structured_output_mode`` explicitly.
    """
    if model is None:
        return None
    if isinstance(model, str):
        return model
    if isinstance(model, list):
        return _model_name(model[0]) if model else None
    # ModelConfig dict
    name = model.get("name")
    return name if isinstance(name, str) else None


def supports_structured_outputs_with_tools(model: Model | None) -> bool:
    """Return True if ``model`` is known to accept JSON-schema + tools in one call.

    Defaults to True when no model is set (the gateway picks a default that
    we expect to be capable). Returns False for any model not matched by a
    known-capable prefix.
    """
    name = _model_name(model)
    if not name:
        return True
    lower = name.lower()
    return any(lower.startswith(p) for p in _SUPPORTS_STRUCTURED_TOOLS)


def use_tool_fallback(
    model: Model | None,
    has_tools: bool,
    has_output_schema: bool,
    mode: StructuredOutputMode | None,
) -> bool:
    """Decide whether this request should use the ``final_answer`` fallback.

    The fallback only kicks in when *both* tools and an output schema are
    requested — otherwise the native paths work everywhere.

    ``mode`` overrides the capability lookup:
      - ``"native"``: never fall back (caller knows the model supports it,
        or wants to surface a provider error).
      - ``"tool"``: always fall back (useful for debugging or when a model
        was recently broken upstream).
      - ``"auto"`` / ``None``: consult the whitelist.
    """
    if not (has_tools and has_output_schema):
        return False
    if mode == "native":
        return False
    if mode == "tool":
        return True
    return not supports_structured_outputs_with_tools(model)


# Public name of the synthetic tool injected when the fallback is active.
# Exposed as a constant so the loop and tests reference the same string.
FINAL_ANSWER_TOOL_NAME = "final_answer"


FINAL_ANSWER_INSTRUCTIONS = (
    "When you have all the information needed to answer, respond by calling the "
    f"`{FINAL_ANSWER_TOOL_NAME}` tool exactly once. Its arguments must match the "
    "required output schema. Do not produce a plain-text final answer — only the "
    f"`{FINAL_ANSWER_TOOL_NAME}` tool call counts as your response."
)
