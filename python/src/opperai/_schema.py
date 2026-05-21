"""Opper SDK — Schema detection, conversion, and response parsing."""

from __future__ import annotations

import copy
import dataclasses
from typing import Any, get_type_hints


def resolve_schema(schema: Any) -> dict[str, Any] | None:
    """Convert a schema-like value to a JSON Schema dict.

    Supports:
    - None -> None (no schema)
    - dict -> pass through as raw JSON Schema
    - Pydantic BaseModel subclass -> model_json_schema()
    - dataclass -> inspect fields
    - TypedDict -> inspect annotations

    Any returned schema is post-processed to inline ``$defs``/``$ref`` so that
    downstream providers (notably OpenAI strict structured output) that don't
    dereference ``$ref`` receive a self-contained schema. Anthropic/Vertex
    accept the schema with refs but silently flatten nested objects, which is
    arguably worse — inlining fixes both cases.
    """
    if schema is None:
        return None

    if isinstance(schema, dict):
        return _inline_refs(schema)

    # Pydantic BaseModel (detected at runtime — no import needed)
    if isinstance(schema, type) and hasattr(schema, "model_json_schema"):
        return _inline_refs(schema.model_json_schema())  # type: ignore[union-attr]

    # dataclass
    if isinstance(schema, type) and dataclasses.is_dataclass(schema):
        return _dataclass_to_json_schema(schema)

    # TypedDict (has __annotations__ and __required_keys__)
    if isinstance(schema, type) and hasattr(schema, "__required_keys__"):
        return _typeddict_to_json_schema(schema)

    # Bare Python types: str, int, float, bool, list, list[str], etc.
    if isinstance(schema, type) and schema in _PYTHON_TYPE_TO_JSON:
        return {"type": _PYTHON_TYPE_TO_JSON[schema]}
    if schema is list:
        return {"type": "array"}
    if schema is dict:
        return {"type": "object"}

    # Generic aliases: list[str], dict[str, int], etc.
    origin = getattr(schema, "__origin__", None)
    if origin is not None:
        resolved = _python_type_to_json_schema(schema)
        if resolved:
            return resolved

    raise TypeError(
        f"Unsupported schema type: {schema!r}. "
        "Expected dict, BaseModel, dataclass, TypedDict, or Python type (str, int, list[str], ...)."
    )


def parse_output(data: Any, schema: Any) -> Any:
    """Parse response data back into the schema type.

    - Pydantic BaseModel -> model_validate(data)
    - dataclass -> construct from dict
    - everything else -> return data as-is
    """
    if schema is None or isinstance(schema, dict):
        return data

    # Pydantic BaseModel
    if isinstance(schema, type) and hasattr(schema, "model_validate"):
        return schema.model_validate(data)  # type: ignore[union-attr]

    # dataclass
    if isinstance(schema, type) and dataclasses.is_dataclass(schema):
        if isinstance(data, dict):
            return schema(**data)
        return data

    return data


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _inline_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Inline ``$defs``/``$ref`` so the returned schema is self-contained.

    Pydantic's ``model_json_schema()`` emits nested models as ``$ref`` pointers
    into a top-level ``$defs`` dict. OpenAI's strict structured-output mode
    rejects schemas where the type at ``items`` is only reachable via ``$ref``
    ("schema must have a 'type' key"), and other providers silently drop the
    nested structure. Inlining sidesteps both.

    Supports ``$defs`` and the legacy ``definitions`` keyword. Self-referential
    schemas leave the ``$ref`` in place to avoid infinite recursion.
    """
    if not isinstance(schema, dict):
        return schema

    defs: dict[str, Any] = {}
    for key in ("$defs", "definitions"):
        if isinstance(schema.get(key), dict):
            defs.update(schema[key])

    if not defs:
        return schema

    result = _deref(schema, defs, in_progress=frozenset())
    if isinstance(result, dict):
        result.pop("$defs", None)
        result.pop("definitions", None)
    return result  # type: ignore[no-any-return]


def _deref(node: Any, defs: dict[str, Any], in_progress: frozenset[str]) -> Any:
    """Recursively replace ``{"$ref": "#/$defs/Name"}`` with the inlined def."""
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            name = _ref_name(ref)
            if name and name in defs and name not in in_progress:
                target = copy.deepcopy(defs[name])
                # Sibling keys alongside $ref (rare, but legal) are dropped to
                # match JSON Schema semantics; if present, merge them in.
                inlined = _deref(target, defs, in_progress | {name})
                if isinstance(inlined, dict):
                    for k, v in node.items():
                        if k == "$ref":
                            continue
                        inlined.setdefault(k, v)
                return inlined
            # Cycle or unresolved ref — leave as-is.
            return node
        return {k: _deref(v, defs, in_progress) for k, v in node.items() if k not in ("$defs", "definitions")}
    if isinstance(node, list):
        return [_deref(item, defs, in_progress) for item in node]
    return node


def _ref_name(ref: str) -> str | None:
    """Extract ``Name`` from ``#/$defs/Name`` or ``#/definitions/Name``."""
    for prefix in ("#/$defs/", "#/definitions/"):
        if ref.startswith(prefix):
            return ref[len(prefix):]
    return None


_PYTHON_TYPE_TO_JSON: dict[type, str] = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
}


def _python_type_to_json_schema(tp: Any) -> dict[str, Any]:
    """Convert a Python type annotation to a JSON Schema fragment."""
    if tp in _PYTHON_TYPE_TO_JSON:
        return {"type": _PYTHON_TYPE_TO_JSON[tp]}

    origin = getattr(tp, "__origin__", None)

    # list[X]
    if origin is list:
        args = getattr(tp, "__args__", ())
        items = _python_type_to_json_schema(args[0]) if args else {}
        return {"type": "array", "items": items}

    # dict[str, X]
    if origin is dict:
        return {"type": "object"}

    # Optional[X] / X | None
    if origin is type(int | str):  # types.UnionType for 3.10+
        args = [a for a in tp.__args__ if a is not type(None)]
        if len(args) == 1:
            return _python_type_to_json_schema(args[0])

    # Fallback
    return {}


def _dataclass_to_json_schema(cls: type) -> dict[str, Any]:
    """Convert a dataclass to JSON Schema."""
    hints = get_type_hints(cls)
    fields = dataclasses.fields(cls)
    properties: dict[str, Any] = {}
    required: list[str] = []

    for f in fields:
        tp = hints.get(f.name, str)
        prop = _python_type_to_json_schema(tp)
        properties[f.name] = prop

        # Required if no default and no default_factory
        has_default = f.default is not dataclasses.MISSING or f.default_factory is not dataclasses.MISSING  # type: ignore[misc]
        # Check if type is Optional (X | None)
        is_optional = _is_optional_type(tp)

        if not has_default and not is_optional:
            required.append(f.name)

    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def _typeddict_to_json_schema(cls: type) -> dict[str, Any]:
    """Convert a TypedDict to JSON Schema."""
    hints = get_type_hints(cls)
    required_keys = getattr(cls, "__required_keys__", set())
    properties: dict[str, Any] = {}

    for name, tp in hints.items():
        properties[name] = _python_type_to_json_schema(tp)

    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required_keys:
        schema["required"] = sorted(required_keys)
    return schema


def _is_optional_type(tp: Any) -> bool:
    """Check if a type is Optional (X | None)."""
    origin = getattr(tp, "__origin__", None)
    if origin is type(int | str):  # types.UnionType for 3.10+
        return type(None) in tp.__args__
    return False
