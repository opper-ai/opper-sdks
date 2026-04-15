"""Tests for the main Opper client (call, stream, trace, media)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opperai._client import Opper, _Trace, _TraceAsync
from opperai._context import get_trace_context, set_trace_context
from opperai.types import ContentChunk, DoneChunk, RunResponse, SpanHandle


class TestOpperInit:
    def test_requires_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OPPER_API_KEY", raising=False)
        with pytest.raises(ValueError, match="Missing API key"):
            Opper()

    def test_accepts_api_key_param(self) -> None:
        o = Opper(api_key="test-key")
        assert o._client._api_key == "test-key"

    def test_reads_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPPER_API_KEY", "env-key")
        o = Opper()
        assert o._client._api_key == "env-key"

    def test_custom_base_url(self) -> None:
        o = Opper(api_key="k", base_url="https://custom.api.com")
        assert o._client._base_url == "https://custom.api.com"

    def test_base_url_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPPER_API_KEY", "k")
        monkeypatch.setenv("OPPER_BASE_URL", "https://env.api.com")
        o = Opper()
        assert o._client._base_url == "https://env.api.com"

    def test_sub_clients_initialized(self, opper: Opper) -> None:
        assert opper.functions is not None
        assert opper.spans is not None
        assert opper.traces is not None
        assert opper.generations is not None
        assert opper.models is not None
        assert opper.embeddings is not None
        assert opper.knowledge is not None
        assert opper.system is not None
        assert opper.beta is not None
        assert opper.beta.web is not None


class TestCall:
    def test_call_posts_and_returns_run_response(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": "hello", "meta": {"function_name": "test"}}
        result = opper.call("my-fn", input={"text": "hi"})
        assert isinstance(result, RunResponse)
        assert result.data == "hello"
        opper._client._post.assert_called_once()
        path = opper._client._post.call_args[0][0]
        assert "/v3/functions/my-fn/call" in path

    def test_call_with_instructions_and_model(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": "ok", "meta": None}
        opper.call("fn", input="x", instructions="be helpful", model="gpt-4")
        body = opper._client._post.call_args[0][1]
        assert body["instructions"] == "be helpful"
        assert body["model"] == "gpt-4"

    def test_call_url_encodes_name(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": None, "meta": None}
        opper.call("my/special fn", input="x")
        path = opper._client._post.call_args[0][0]
        assert "my%2Fspecial%20fn" in path

    async def test_call_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"data": "async-result", "meta": None}
        result = await opper.call_async("fn", input="x")
        assert result.data == "async-result"

    def test_call_with_output_schema_dict(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": {"name": "Alice"}, "meta": None}
        schema = {"type": "object", "properties": {"name": {"type": "string"}}}
        result = opper.call("fn", input="x", output_schema=schema)
        body = opper._client._post.call_args[0][1]
        assert body["output_schema"] == schema
        assert result.data == {"name": "Alice"}

    def test_call_propagates_trace_context(self, opper: Opper) -> None:
        from opperai._context import TraceContext

        set_trace_context(None)
        set_trace_context(TraceContext(span_id="span-1", trace_id="trace-1"))
        try:
            opper._client._post.return_value = {"data": "ok", "meta": None}
            opper.call("fn", input="x")
            body = opper._client._post.call_args[0][1]
            assert body["parent_span_id"] == "span-1"
        finally:
            set_trace_context(None)

    def test_call_explicit_parent_span_overrides_context(self, opper: Opper) -> None:
        from opperai._context import TraceContext

        set_trace_context(TraceContext(span_id="ctx-span", trace_id="ctx-trace"))
        try:
            opper._client._post.return_value = {"data": "ok", "meta": None}
            opper.call("fn", input="x", parent_span_id="explicit-span")
            body = opper._client._post.call_args[0][1]
            assert body["parent_span_id"] == "explicit-span"
        finally:
            set_trace_context(None)


class TestStream:
    def test_stream_returns_iterator(self, opper: Opper) -> None:
        chunks = [ContentChunk(delta="hi"), DoneChunk()]
        opper._client._stream_sse.return_value = iter(chunks)
        result = list(opper.stream("fn", input="x"))
        assert len(result) == 2
        assert result[0].delta == "hi"

    async def test_stream_async(self, opper: Opper) -> None:
        chunks = [ContentChunk(delta="async"), DoneChunk()]

        async def async_gen():
            for c in chunks:
                yield c

        # stream_async returns _stream_sse_async(...) without await,
        # so use MagicMock (not AsyncMock) to return the async gen directly
        opper._client._stream_sse_async = MagicMock(return_value=async_gen())  # type: ignore[method-assign]
        result = []
        async for chunk in await opper.stream_async("fn", input="x"):
            result.append(chunk)
        assert len(result) == 2


class TestTrace:
    def test_trace_context_manager(self, opper: Opper) -> None:
        set_trace_context(None)
        opper._client._post.return_value = {"data": {"id": "s1", "trace_id": "t1", "name": "test"}}
        opper._client._patch.return_value = None
        with opper.trace("my-trace") as span:
            assert isinstance(span, SpanHandle)
            assert span.id == "s1"
            assert span.trace_id == "t1"
            ctx = get_trace_context()
            assert ctx is not None
            assert ctx.span_id == "s1"
        # Context should be cleared after exit
        assert get_trace_context() is None

    def test_trace_records_error(self, opper: Opper) -> None:
        set_trace_context(None)
        opper._client._post.return_value = {"data": {"id": "s1", "trace_id": "t1", "name": "test"}}
        opper._client._patch.return_value = None
        with pytest.raises(ValueError):
            with opper.trace("err-trace"):
                raise ValueError("boom")
        patch_call = opper._client._patch.call_args
        body = patch_call[0][1]
        assert body["error"] == "boom"

    async def test_trace_async_context_manager(self, opper: Opper) -> None:
        set_trace_context(None)
        opper._client._post_async.return_value = {"data": {"id": "s2", "trace_id": "t2", "name": "test"}}
        opper._client._patch_async.return_value = None
        async with opper.trace_async("async-trace") as span:
            assert span.id == "s2"
            assert span.trace_id == "t2"

    def test_trace_as_decorator(self, opper: Opper) -> None:
        set_trace_context(None)
        opper._client._post.return_value = {"data": {"id": "s3", "trace_id": "t3", "name": "dec"}}
        opper._client._patch.return_value = None

        @opper.trace("decorated")
        def my_fn():
            return 42

        result = my_fn()
        assert result == 42
        opper._client._post.assert_called_once()


class TestMedia:
    def test_generate_image(self, opper: Opper) -> None:
        opper._client._post.return_value = {
            "data": {"image": "base64data", "mime_type": "image/png"},
            "meta": None,
        }
        result = opper.generate_image(prompt="a sunset")
        assert result.data["image"] == "base64data"
        body = opper._client._post.call_args[0][1]
        assert body["input"]["description"] == "a sunset"

    def test_text_to_speech(self, opper: Opper) -> None:
        opper._client._post.return_value = {
            "data": {"audio": "audiobase64", "mime_type": "audio/mp3"},
            "meta": None,
        }
        result = opper.text_to_speech(text="hello world")
        assert result.data["audio"] == "audiobase64"

    def test_transcribe(self, opper: Opper) -> None:
        opper._client._post.return_value = {"data": {"text": "transcribed"}, "meta": None}
        result = opper.transcribe(audio="base64audio")
        assert result.data["text"] == "transcribed"

    async def test_generate_image_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {
            "data": {"image": "b64", "mime_type": "image/png"},
            "meta": None,
        }
        result = await opper.generate_image_async(prompt="a cat")
        assert result.data["image"] == "b64"
