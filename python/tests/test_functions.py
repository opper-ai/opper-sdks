"""Tests for FunctionsClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import FunctionDetails, FunctionInfo, FunctionRevision, RealtimeCreateResponse, RevisionInfo


class TestFunctionsList:
    def test_list(self, opper: Opper) -> None:
        opper._client._get.return_value = {
            "functions": [
                {"name": "fn1", "schema_hash": "abc", "generated_at": "", "hit_count": 5, "has_script": True},
                {"name": "fn2", "schema_hash": "def", "generated_at": "", "hit_count": 0, "has_script": False},
            ]
        }
        result = opper.functions.list()
        assert len(result) == 2
        assert isinstance(result[0], FunctionInfo)
        assert result[0].name == "fn1"
        assert result[0].has_script is True

    async def test_list_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"functions": [{"name": "fn1"}]}
        result = await opper.functions.list_async()
        assert len(result) == 1


class TestFunctionsGet:
    def test_get(self, opper: Opper) -> None:
        opper._client._get.return_value = {
            "name": "fn1",
            "schema_hash": "abc",
            "generated_at": "",
            "hit_count": 0,
            "source": "code",
            "input_schema": {},
            "output_schema": {},
        }
        result = opper.functions.get("fn1")
        assert isinstance(result, FunctionDetails)
        assert result.name == "fn1"
        assert result.source == "code"

    async def test_get_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"name": "fn1"}
        result = await opper.functions.get_async("fn1")
        assert result.name == "fn1"


class TestFunctionsUpdate:
    def test_update(self, opper: Opper) -> None:
        opper._client._put.return_value = {"name": "fn1", "source": "new code"}
        result = opper.functions.update("fn1", source="new code")
        assert isinstance(result, FunctionDetails)
        opper._client._put.assert_called_once()

    async def test_update_async(self, opper: Opper) -> None:
        opper._client._put_async.return_value = {"name": "fn1", "source": "new"}
        result = await opper.functions.update_async("fn1", source="new")
        assert result.name == "fn1"


class TestFunctionsDelete:
    def test_delete(self, opper: Opper) -> None:
        opper._client._delete.return_value = None
        opper.functions.delete("fn1")
        opper._client._delete.assert_called_once()

    async def test_delete_async(self, opper: Opper) -> None:
        opper._client._delete_async.return_value = None
        await opper.functions.delete_async("fn1")
        opper._client._delete_async.assert_called_once()


class TestFunctionsRun:
    def test_run(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": "result", "meta": {"function_name": "fn1"}}
        result = opper.functions.run("fn1", {"input": "hello"})
        assert result.data == "result"

    async def test_run_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"data": "async-result", "meta": None}
        result = await opper.functions.run_async("fn1", {"input": "hi"})
        assert result.data == "async-result"


class TestFunctionsRealtime:
    def test_create_realtime(self, opper: Opper) -> None:
        opper._client._post.return_value = {"name": "rt-fn", "script": "code", "cached": False}
        result = opper.functions.create_realtime("rt-fn", instructions="do stuff")
        assert isinstance(result, RealtimeCreateResponse)
        assert result.name == "rt-fn"

    def test_get_realtime_ws_url(self, opper: Opper) -> None:
        url = opper.functions.get_realtime_ws_url("my-fn")
        assert url.startswith("wss://")
        assert "my-fn" in url

    async def test_create_realtime_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"name": "rt", "script": "s", "cached": True}
        result = await opper.functions.create_realtime_async("rt", instructions="x")
        assert result.cached is True


class TestFunctionsRevisions:
    def test_list_revisions(self, opper: Opper) -> None:
        opper._client._get.return_value = {
            "revisions": [{"revision_id": 1, "created_at": "", "schema_hash": "h", "is_current": True}]
        }
        result = opper.functions.list_revisions("fn1")
        assert len(result) == 1
        assert isinstance(result[0], RevisionInfo)

    def test_get_revision(self, opper: Opper) -> None:
        opper._client._get.return_value = {"revision_id": 1, "source": "v1"}
        result = opper.functions.get_revision("fn1", 1)
        assert isinstance(result, FunctionRevision)

    def test_revert_revision(self, opper: Opper) -> None:
        opper._client._post.return_value = {"name": "fn1", "source": "v1"}
        result = opper.functions.revert_revision("fn1", 1)
        assert isinstance(result, FunctionDetails)


class TestFunctionsExamples:
    def test_create_example(self, opper: Opper) -> None:
        opper._client._post.return_value = {"id": "ex1"}
        result = opper.functions.create_example("fn1", input={"q": "hi"}, output={"a": "hello"})
        assert result == {"id": "ex1"}

    def test_list_examples(self, opper: Opper) -> None:
        opper._client._get.return_value = {"examples": [{"id": "ex1"}, {"id": "ex2"}]}
        result = opper.functions.list_examples("fn1", limit=10, tag="test")
        assert len(result) == 2

    def test_delete_example(self, opper: Opper) -> None:
        opper._client._delete.return_value = None
        opper.functions.delete_example("fn1", "uuid-1")
        opper._client._delete.assert_called_once()

    async def test_create_example_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"id": "ex1"}
        result = await opper.functions.create_example_async("fn1", input={"q": "hi"}, output={"a": "yo"})
        assert result == {"id": "ex1"}
