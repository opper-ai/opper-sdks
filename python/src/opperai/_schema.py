"""Opper SDK — Schema detection, conversion, and response parsing."""

from __future__ import annotations

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
    """
    if schema is None:
        return None

    if isinstance(schema, dict):
        return schema

    # Pydantic BaseModel (detected at runtime — no import needed)
    if isinstance(schema, type) and hasattr(schema, "model_json_schema"):
        return schema.model_json_schema()  # type: ignore[union-attr]

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
