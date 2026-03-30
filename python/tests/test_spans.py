"""Tests for SpansClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import CreateSpanResponse, GetSpanResponse


class TestSpansCreate:
    def test_create(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": {"id": "s1", "trace_id": "t1", "name": "my-span"}}
        result = opper.spans.create(name="my-span")
        assert isinstance(result, CreateSpanResponse)
        assert result.id == "s1"
        assert result.trace_id == "t1"

    def test_create_with_all_fields(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": {"id": "s2", "trace_id": "t2", "name": "full"}}
        result = opper.spans.create(
            name="full",
            trace_id="t2",
            parent_id="p1",
            type="llm",
            input="in",
            output="out",
            start_time="2024-01-01T00:00:00Z",
            meta={"key": "val"},
            tags={"env": "test"},
        )
        body = opper._client._post.call_args[0][1]
        assert body["trace_id"] == "t2"
        assert body["parent_id"] == "p1"
        assert body["type"] == "llm"
        assert body["meta"] == {"key": "val"}

    async def test_create_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"data": {"id": "s3", "trace_id": "t3", "name": "async"}}
        result = await opper.spans.create_async(name="async")
        assert result.id == "s3"


class TestSpansUpdate:
    def test_update(self, opper: Opper) -> None:
        opper._client._patch.return_value = None
        opper.spans.update("s1", output="done", end_time="2024-01-01T01:00:00Z")
        body = opper._client._patch.call_args[0][1]
        assert body["output"] == "done"
        assert body["end_time"] == "2024-01-01T01:00:00Z"

    async def test_update_async(self, opper: Opper) -> None:
        opper._client._patch_async.return_value = None
        await opper.spans.update_async("s1", error="oops")
        body = opper._client._patch_async.call_args[0][1]
        assert body["error"] == "oops"


class TestSpansGet:
    def test_get(self, opper: Opper) -> None:
        opper._client._get.return_value = {"data": {"id": "s1", "trace_id": "t1", "name": "span", "status": "ok"}}
        result = opper.spans.get("s1")
        assert isinstance(result, GetSpanResponse)
        assert result.id == "s1"

    async def test_get_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"data": {"id": "s2", "trace_id": "t2", "name": "async-span"}}
        result = await opper.spans.get_async("s2")
        assert result.id == "s2"


class TestSpansDelete:
    def test_delete(self, opper: Opper) -> None:
        opper._client._delete.return_value = None
        opper.spans.delete("s1")
        opper._client._delete.assert_called_once()

    async def test_delete_async(self, opper: Opper) -> None:
        opper._client._delete_async.return_value = None
        await opper.spans.delete_async("s1")
        opper._client._delete_async.assert_called_once()
