"""Tests for GenerationsClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import GenerationsListResponse


class TestGenerations:
    def test_list(self, opper: Opper) -> None:
        opper._client._get.return_value = {
            "data": [{"id": "g1", "output": "hello"}],
            "meta": {"page": 1, "page_size": 50, "total_count": 1, "total_pages": 1},
        }
        result = opper.generations.list()
        assert isinstance(result, GenerationsListResponse)
        assert len(result.data) == 1
        assert result.meta.total_count == 1

    def test_list_with_params(self, opper: Opper) -> None:
        opper._client._get.return_value = {"data": [], "meta": {}}
        opper.generations.list(query="search", page=2, page_size=10)
        call_kwargs = opper._client._get.call_args
        assert call_kwargs.kwargs["query"] == {"query": "search", "page": 2, "page_size": 10}

    def test_get(self, opper: Opper) -> None:
        opper._client._get.return_value = {"id": "g1", "output": "hello"}
        result = opper.generations.get("g1")
        assert result["id"] == "g1"

    def test_delete(self, opper: Opper) -> None:
        opper._client._delete.return_value = {"deleted": True}
        result = opper.generations.delete("g1")
        assert result["deleted"] is True

    async def test_list_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"data": [], "meta": {"page": 1, "page_size": 50, "total_count": 0, "total_pages": 0}}
        result = await opper.generations.list_async()
        assert len(result.data) == 0

    async def test_get_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"id": "g1"}
        result = await opper.generations.get_async("g1")
        assert result["id"] == "g1"
