"""Tests for _from_dict helper — forward-compatible dataclass deserialization."""

from dataclasses import dataclass, field

from opperai.types import ModelInfo, _from_dict


@dataclass(frozen=True)
class _Sample:
    name: str = ""
    value: int = 0
    tags: list[str] = field(default_factory=list)


def test_known_fields():
    result = _from_dict(_Sample, {"name": "a", "value": 1, "tags": ["x"]})
    assert result == _Sample(name="a", value=1, tags=["x"])


def test_unknown_fields_ignored():
    result = _from_dict(_Sample, {"name": "a", "value": 1, "extra": True, "another": [1, 2]})
    assert result == _Sample(name="a", value=1)


def test_missing_fields_use_defaults():
    result = _from_dict(_Sample, {"name": "b"})
    assert result == _Sample(name="b", value=0, tags=[])


def test_empty_dict():
    result = _from_dict(_Sample, {})
    assert result == _Sample()


def test_model_info_with_unknown_field():
    """Regression test: new API fields should not crash ModelInfo."""
    data = {"id": "m1", "name": "test-model", "future_field": "surprise"}
    model = _from_dict(ModelInfo, data)
    assert model.id == "m1"
    assert model.name == "test-model"
