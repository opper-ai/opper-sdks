"""Tests for schema resolution and output parsing."""

from __future__ import annotations

import dataclasses
from typing import TypedDict

import pytest

from opperai._schema import parse_output, resolve_schema


class TestResolveSchema:
    def test_none_returns_none(self) -> None:
        assert resolve_schema(None) is None

    def test_dict_passthrough(self) -> None:
        schema = {"type": "object", "properties": {"name": {"type": "string"}}}
        assert resolve_schema(schema) is schema

    def test_python_type_str(self) -> None:
        assert resolve_schema(str) == {"type": "string"}

    def test_python_type_int(self) -> None:
        assert resolve_schema(int) == {"type": "integer"}

    def test_python_type_float(self) -> None:
        assert resolve_schema(float) == {"type": "number"}

    def test_python_type_bool(self) -> None:
        assert resolve_schema(bool) == {"type": "boolean"}

    def test_bare_list(self) -> None:
        assert resolve_schema(list) == {"type": "array"}

    def test_bare_dict(self) -> None:
        assert resolve_schema(dict) == {"type": "object"}

    def test_list_of_str(self) -> None:
        result = resolve_schema(list[str])
        assert result == {"type": "array", "items": {"type": "string"}}

    def test_dataclass(self) -> None:
        @dataclasses.dataclass
        class Person:
            name: str
            age: int

        result = resolve_schema(Person)
        assert result is not None
        assert result["type"] == "object"
        assert "name" in result["properties"]
        assert "age" in result["properties"]
        assert "name" in result["required"]

    def test_typeddict(self) -> None:
        class Item(TypedDict):
            title: str
            count: int

        result = resolve_schema(Item)
        assert result is not None
        assert result["type"] == "object"
        assert "title" in result["properties"]

    def test_unsupported_raises(self) -> None:
        with pytest.raises(TypeError, match="Unsupported schema type"):
            resolve_schema(object)


class TestResolveSchemaWithPydantic:
    def test_pydantic_model(self) -> None:
        try:
            from pydantic import BaseModel
        except ImportError:
            pytest.skip("pydantic not installed")

        class User(BaseModel):
            name: str
            email: str

        result = resolve_schema(User)
        assert result is not None
        assert "properties" in result
        assert "name" in result["properties"]

    def test_pydantic_nested_model_inlines_refs(self) -> None:
        """Nested Pydantic models must not leave `$ref`/`$defs` in the schema.

        Regression: OpenAI strict mode rejects unresolved `$ref` with a 400,
        and Anthropic/Vertex silently flatten nested objects into scalars.
        """
        try:
            from pydantic import BaseModel
        except ImportError:
            pytest.skip("pydantic not installed")

        class Person(BaseModel):
            name: str
            role: str | None = None

        class Entities(BaseModel):
            people: list[Person]
            locations: list[str]

        result = resolve_schema(Entities)
        assert result is not None
        assert "$defs" not in result
        assert "definitions" not in result
        people = result["properties"]["people"]
        assert people["type"] == "array"
        # items must be the inlined Person object, not a $ref
        assert "$ref" not in people["items"]
        assert people["items"]["type"] == "object"
        assert "name" in people["items"]["properties"]

    def test_pydantic_self_referential_does_not_recurse(self) -> None:
        """Self-referential models should leave the cycle as `$ref` rather
        than infinite-loop. Most providers don't support recursive schemas
        anyway; the SDK's job is to not crash."""
        try:
            from pydantic import BaseModel
        except ImportError:
            pytest.skip("pydantic not installed")

        class Node(BaseModel):
            value: str
            children: list[Node] = []

        Node.model_rebuild()

        result = resolve_schema(Node)
        assert result is not None
        # Did not infinite-loop. Top-level $defs is still stripped.
        assert "$defs" not in result


class TestInlineRefsDict:
    def test_dict_input_inlines_refs(self) -> None:
        schema = {
            "$defs": {"Item": {"type": "object", "properties": {"x": {"type": "integer"}}}},
            "type": "array",
            "items": {"$ref": "#/$defs/Item"},
        }
        result = resolve_schema(schema)
        assert result is not None
        assert "$defs" not in result
        assert result["items"]["type"] == "object"
        assert result["items"]["properties"]["x"]["type"] == "integer"

    def test_dict_without_refs_unchanged(self) -> None:
        schema = {"type": "object", "properties": {"name": {"type": "string"}}}
        result = resolve_schema(schema)
        assert result == schema

    def test_legacy_definitions_keyword(self) -> None:
        schema = {
            "definitions": {"Foo": {"type": "string"}},
            "type": "object",
            "properties": {"foo": {"$ref": "#/definitions/Foo"}},
        }
        result = resolve_schema(schema)
        assert result is not None
        assert "definitions" not in result
        assert result["properties"]["foo"] == {"type": "string"}


class TestParseOutput:
    def test_none_schema_returns_data(self) -> None:
        assert parse_output({"x": 1}, None) == {"x": 1}

    def test_dict_schema_returns_data(self) -> None:
        assert parse_output("hello", {"type": "string"}) == "hello"

    def test_dataclass_schema_constructs(self) -> None:
        @dataclasses.dataclass
        class Point:
            x: int
            y: int

        result = parse_output({"x": 1, "y": 2}, Point)
        assert isinstance(result, Point)
        assert result.x == 1

    def test_dataclass_non_dict_data(self) -> None:
        @dataclasses.dataclass
        class Wrapper:
            val: str

        result = parse_output("raw", Wrapper)
        assert result == "raw"

    def test_pydantic_model_validate(self) -> None:
        try:
            from pydantic import BaseModel
        except ImportError:
            pytest.skip("pydantic not installed")

        class Config(BaseModel):
            key: str
            value: int

        result = parse_output({"key": "a", "value": 1}, Config)
        assert isinstance(result, Config)
        assert result.key == "a"
