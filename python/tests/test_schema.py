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
