"""Tests for TracesClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import GetTraceResponse, ListTracesResponse


class TestTracesList:
    def test_list(self, opper: Opper) -> None:
        opper._client._get.return_value = {
            "data": [
                {"id": "t1", "name": "trace-1", "span_count": 3},
                {"id": "t2", "name": "trace-2", "span_count": 1},
            ],
            "meta": {"total": 2},
        }
        result = opper.traces.list()
        assert isinstance(result, ListTracesResponse)
        assert len(result.data) == 2
        assert result.data[0].id == "t1"

    def test_list_with_filters(self, opper: Opper) -> None:
        opper._client._get.return_value = {"data": [], "meta": {}}
        opper.traces.list(limit=5, offset=10, name="my-trace")
        call_kwargs = opper._client._get.call_args
        assert call_kwargs.kwargs["query"] == {"limit": 5, "offset": 10, "name": "my-trace"}

    async def test_list_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"data": [{"id": "t1"}], "meta": {}}
        result = await opper.traces.list_async()
        assert len(result.data) == 1


class TestTracesGet:
    def test_get(self, opper: Opper) -> None:
        opper._client._get.return_value = {
            "id": "t1",
            "name": "trace-1",
            "span_count": 2,
            "spans": [
                {"id": "s1", "trace_id": "t1", "name": "span-1"},
                {"id": "s2", "trace_id": "t1", "name": "span-2"},
            ],
            "start_time": "2024-01-01T00:00:00Z",
            "duration_ms": 500,
        }
        result = opper.traces.get("t1")
        assert isinstance(result, GetTraceResponse)
        assert result.id == "t1"
        assert len(result.spans) == 2
        assert result.spans[0].name == "span-1"

    async def test_get_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"id": "t1", "spans": [], "span_count": 0}
        result = await opper.traces.get_async("t1")
        assert result.id == "t1"


class TestTracesDelete:
    def test_delete(self, opper: Opper) -> None:
        opper._client._delete.return_value = None
        opper.traces.delete("t1")
        opper._client._delete.assert_called_once()

    async def test_delete_async(self, opper: Opper) -> None:
        opper._client._delete_async.return_value = None
        await opper.traces.delete_async("t1")
        opper._client._delete_async.assert_called_once()
