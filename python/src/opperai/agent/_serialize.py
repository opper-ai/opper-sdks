"""Agent SDK — serialisation helpers.

Two sibling helpers that are used across the agent module:

* ``to_json_str`` always returns a **valid JSON string**. Use it for protocol
  payloads (OpenResponses ``function_call.arguments`` / ``function_call_output.output``
  and the ``as_tool`` wrapper output) — downstream consumers rely on
  ``json.loads`` round-tripping the value.

* ``to_text`` is a best-effort human-readable string. Use it for trace span
  display (``input``/``output`` on a span) and for assistant-message ``content``.
  Raw strings pass through unchanged so span inputs don't get double-quoted.

Neither helper raises — tracing must never break the agent, and corrupting a
protocol item because a user returned a Pydantic model from a tool is worse
than emitting a best-effort string.
"""

from __future__ import annotations

import dataclasses
import json
from typing import Any


def _json_default(obj: Any) -> Any:
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return dataclasses.asdict(obj)
    return str(obj)


def to_json_str(obj: Any) -> str:
    """Serialise ``obj`` to a valid JSON string.

    Callers rely on this round-tripping via ``json.loads`` (protocol payloads).
    Never raises — falls back to a JSON-encoded ``repr`` for otherwise
    unserialisable values.
    """
    if hasattr(obj, "model_dump_json"):
        try:
            return obj.model_dump_json()
        except Exception:
            pass
    try:
        return json.dumps(obj, default=_json_default)
    except Exception:
        return json.dumps(repr(obj))


def to_text(obj: Any) -> str:
    """Return a best-effort human-readable string for ``obj``.

    Raw strings pass through unchanged; other values are JSON-encoded.
    ``None`` becomes the empty string.
    """
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    return to_json_str(obj)
