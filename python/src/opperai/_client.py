"""Opper SDK — Main Client."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timezone
from typing import Any, TypeVar, overload

from ._base_client import BaseClient
from ._context import TraceContext, get_trace_context, set_trace_context
from ._schema import parse_output, resolve_schema
from .clients.embeddings import EmbeddingsClient
from .clients.functions import FunctionsClient
from .clients.generations import GenerationsClient
from .clients.knowledge import KnowledgeClient
from .clients.models import ModelsClient
from .clients.spans import SpansClient
from .clients.system import SystemClient
from .clients.traces import TracesClient
from .clients.web_tools import WebToolsClient
from .types import (
    MediaResponse,
    RunResponse,
    SpanHandle,
    StreamChunk,
)

T = TypeVar("T")

DEFAULT_BASE_URL = "https://api.opper.ai"


class _BetaNamespace:
    """Namespace for beta API endpoints."""

    def __init__(self, client: BaseClient) -> None:
        self.web = WebToolsClient(client)


class _Trace:
    """Dual-use object: decorator and context manager for tracing.

    Usage as decorator:
        @opper.trace("my-pipeline")
        def my_pipeline():
            ...

    Usage as context manager:
        with opper.trace("my-pipeline") as span:
            ...
    """

    def __init__(
        self,
        opper: Opper,
        name: str = "traced",
        *,
        input: str | None = None,
        meta: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
    ) -> None:
        self._opper = opper
        self._name = name
        self._input = input
        self._meta = meta
        self._tags = tags
        self._span_handle: SpanHandle | None = None
        self._token: Any = None

    def __call__(self, fn: Any) -> Any:
        """Use as a decorator for sync functions."""
        import functools

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with self.__class__(self._opper, self._name, input=self._input, meta=self._meta, tags=self._tags):
                return fn(*args, **kwargs)

        return wrapper

    def __enter__(self) -> SpanHandle:
        parent_ctx = get_trace_context()
        create_kwargs: dict[str, Any] = {
            "name": self._name,
            "start_time": datetime.now(timezone.utc).isoformat(),
        }
        if self._input is not None:
            create_kwargs["input"] = self._input
        if self._meta is not None:
            create_kwargs["meta"] = self._meta
        if self._tags is not None:
            create_kwargs["tags"] = self._tags
        if parent_ctx:
            create_kwargs["trace_id"] = parent_ctx.trace_id
            create_kwargs["parent_id"] = parent_ctx.span_id

        span = self._opper.spans.create(**create_kwargs)
        self._span_handle = SpanHandle(id=span.id, trace_id=span.trace_id)
        set_trace_context(TraceContext(span_id=span.id, trace_id=span.trace_id))
        return self._span_handle

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._span_handle is None:
            return
        update_kwargs: dict[str, Any] = {"end_time": datetime.now(timezone.utc).isoformat()}
        if exc_val is not None:
            update_kwargs["error"] = str(exc_val)
        self._opper.spans.update(self._span_handle.id, **update_kwargs)
        # Restore parent context
        parent_ctx = get_trace_context()
        if parent_ctx and parent_ctx.span_id == self._span_handle.id:
            set_trace_context(None)


class _TraceAsync:
    """Async version of _Trace: decorator and async context manager."""

    def __init__(
        self,
        opper: Opper,
        name: str = "traced",
        *,
        input: str | None = None,
        meta: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
    ) -> None:
        self._opper = opper
        self._name = name
        self._input = input
        self._meta = meta
        self._tags = tags
        self._span_handle: SpanHandle | None = None

    def __call__(self, fn: Any) -> Any:
        """Use as a decorator for async functions."""
        import functools

        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            async with self.__class__(self._opper, self._name, input=self._input, meta=self._meta, tags=self._tags):
                return await fn(*args, **kwargs)

        return wrapper

    async def __aenter__(self) -> SpanHandle:
        parent_ctx = get_trace_context()
        create_kwargs: dict[str, Any] = {
            "name": self._name,
            "start_time": datetime.now(timezone.utc).isoformat(),
        }
        if self._input is not None:
            create_kwargs["input"] = self._input
        if self._meta is not None:
            create_kwargs["meta"] = self._meta
        if self._tags is not None:
            create_kwargs["tags"] = self._tags
        if parent_ctx:
            create_kwargs["trace_id"] = parent_ctx.trace_id
            create_kwargs["parent_id"] = parent_ctx.span_id

        span = await self._opper.spans.create_async(**create_kwargs)
        self._span_handle = SpanHandle(id=span.id, trace_id=span.trace_id)
        set_trace_context(TraceContext(span_id=span.id, trace_id=span.trace_id))
        return self._span_handle

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._span_handle is None:
            return
        update_kwargs: dict[str, Any] = {"end_time": datetime.now(timezone.utc).isoformat()}
        if exc_val is not None:
            update_kwargs["error"] = str(exc_val)
        await self._opper.spans.update_async(self._span_handle.id, **update_kwargs)
        parent_ctx = get_trace_context()
        if parent_ctx and parent_ctx.span_id == self._span_handle.id:
            set_trace_context(None)


class Opper:
    """Opper API client. Pass api_key or set OPPER_API_KEY env var."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        resolved_key = api_key or os.environ.get("OPPER_API_KEY", "")
        if not resolved_key:
            raise ValueError("Missing API key. Pass api_key or set the OPPER_API_KEY environment variable.")
        resolved_url = base_url or os.environ.get("OPPER_BASE_URL", DEFAULT_BASE_URL)

        self._client = BaseClient(resolved_key, resolved_url, headers)

        # Sub-clients
        self.functions = FunctionsClient(self._client)
        self.spans = SpansClient(self._client)
        self.traces = TracesClient(self._client)
        self.generations = GenerationsClient(self._client)
        self.models = ModelsClient(self._client)
        self.embeddings = EmbeddingsClient(self._client)
        self.knowledge = KnowledgeClient(self._client)
        self.system = SystemClient(self._client)
        self.beta = _BetaNamespace(self._client)

    # --- Core execution -------------------------------------------------------

    @overload
    def call(
        self,
        name: str,
        *,
        input: Any,
        output_schema: type[T],
        input_schema: Any = ...,
        instructions: str | None = ...,
        model: str | None = ...,
        tools: list[dict[str, Any]] | None = ...,
        parent_span_id: str | None = ...,
    ) -> RunResponse[T]: ...
    @overload
    def call(
        self,
        name: str,
        *,
        input: Any,
        output_schema: Any = ...,
        input_schema: Any = ...,
        instructions: str | None = ...,
        model: str | None = ...,
        tools: list[dict[str, Any]] | None = ...,
        parent_span_id: str | None = ...,
    ) -> RunResponse[Any]: ...

    def call(
        self,
        name: str,
        *,
        input: Any,
        input_schema: Any = None,
        output_schema: Any = None,
        instructions: str | None = None,
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        parent_span_id: str | None = None,
    ) -> RunResponse[Any]:
        request = self._build_request(
            input=input,
            input_schema=input_schema,
            output_schema=output_schema,
            instructions=instructions,
            model=model,
            parent_span_id=parent_span_id,
            tools=tools,
        )
        data = self._client._post(f"/v3/functions/{_quote(name)}/call", request)
        result_data = parse_output(data.get("data"), output_schema)
        return RunResponse(data=result_data, meta=data.get("meta"))

    @overload
    async def call_async(
        self,
        name: str,
        *,
        input: Any,
        output_schema: type[T],
        input_schema: Any = ...,
        instructions: str | None = ...,
        model: str | None = ...,
        tools: list[dict[str, Any]] | None = ...,
        parent_span_id: str | None = ...,
    ) -> RunResponse[T]: ...
    @overload
    async def call_async(
        self,
        name: str,
        *,
        input: Any,
        output_schema: Any = ...,
        input_schema: Any = ...,
        instructions: str | None = ...,
        model: str | None = ...,
        tools: list[dict[str, Any]] | None = ...,
        parent_span_id: str | None = ...,
    ) -> RunResponse[Any]: ...

    async def call_async(
        self,
        name: str,
        *,
        input: Any,
        input_schema: Any = None,
        output_schema: Any = None,
        instructions: str | None = None,
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        parent_span_id: str | None = None,
    ) -> RunResponse[Any]:
        request = self._build_request(
            input=input,
            input_schema=input_schema,
            output_schema=output_schema,
            instructions=instructions,
            model=model,
            parent_span_id=parent_span_id,
            tools=tools,
        )
        data = await self._client._post_async(f"/v3/functions/{_quote(name)}/call", request)
        result_data = parse_output(data.get("data"), output_schema)
        return RunResponse(data=result_data, meta=data.get("meta"))

    def stream(
        self,
        name: str,
        *,
        input: Any,
        input_schema: Any = None,
        output_schema: Any = None,
        instructions: str | None = None,
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        parent_span_id: str | None = None,
    ) -> Iterator[StreamChunk]:
        request = self._build_request(
            input=input,
            input_schema=input_schema,
            output_schema=output_schema,
            instructions=instructions,
            model=model,
            parent_span_id=parent_span_id,
            tools=tools,
        )
        return self._client._stream_sse(f"/v3/functions/{_quote(name)}/stream", request)

    async def stream_async(
        self,
        name: str,
        *,
        input: Any,
        input_schema: Any = None,
        output_schema: Any = None,
        instructions: str | None = None,
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        parent_span_id: str | None = None,
    ) -> AsyncIterator[StreamChunk]:
        request = self._build_request(
            input=input,
            input_schema=input_schema,
            output_schema=output_schema,
            instructions=instructions,
            model=model,
            parent_span_id=parent_span_id,
            tools=tools,
        )
        return self._client._stream_sse_async(f"/v3/functions/{_quote(name)}/stream", request)

    # --- Tracing --------------------------------------------------------------

    @overload
    def trace(self, name: str) -> _Trace: ...
    @overload
    def trace(
        self,
        *,
        name: str = "traced",
        input: str | None = None,
        meta: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
    ) -> _Trace: ...

    def trace(
        self,
        name: str | None = None,
        *,
        input: str | None = None,
        meta: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> _Trace:
        return _Trace(self, name or "traced", input=input, meta=meta, tags=tags)

    @overload
    def trace_async(self, name: str) -> _TraceAsync: ...
    @overload
    def trace_async(
        self,
        *,
        name: str = "traced",
        input: str | None = None,
        meta: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
    ) -> _TraceAsync: ...

    def trace_async(
        self,
        name: str | None = None,
        *,
        input: str | None = None,
        meta: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> _TraceAsync:
        return _TraceAsync(self, name or "traced", input=input, meta=meta, tags=tags)

    # --- Media Convenience Methods --------------------------------------------

    def generate_image(
        self,
        name: str | None = None,
        *,
        prompt: str,
        reference_image: str | bytes | None = None,
        model: str | None = None,
        size: str | None = None,
        quality: str | None = None,
        style: str | None = None,
        n: int | None = None,
        mime_type: str | None = None,
    ) -> MediaResponse:
        input_schema, input_data = _build_image_request(prompt, reference_image, size, quality, style, n, mime_type)
        r = self.call(
            name or "image-gen",
            input=input_data,
            input_schema=input_schema,
            output_schema=_image_output_schema(),
            model=model,
        )
        return MediaResponse(r.data, r.meta, base64_field="image", mime_field="mime_type")

    async def generate_image_async(
        self,
        name: str | None = None,
        *,
        prompt: str,
        reference_image: str | bytes | None = None,
        model: str | None = None,
        size: str | None = None,
        quality: str | None = None,
        style: str | None = None,
        n: int | None = None,
        mime_type: str | None = None,
    ) -> MediaResponse:
        input_schema, input_data = _build_image_request(prompt, reference_image, size, quality, style, n, mime_type)
        r = await self.call_async(
            name or "image-gen",
            input=input_data,
            input_schema=input_schema,
            output_schema=_image_output_schema(),
            model=model,
        )
        return MediaResponse(r.data, r.meta, base64_field="image", mime_field="mime_type")

    def generate_video(
        self,
        name: str | None = None,
        *,
        prompt: str,
        model: str | None = None,
        aspect_ratio: str | None = None,
    ) -> MediaResponse:
        input_schema, input_data = _build_video_request(prompt, aspect_ratio)
        r = self.call(
            name or "video-gen",
            input=input_data,
            input_schema=input_schema,
            output_schema=_video_output_schema(),
            model=model,
        )
        return MediaResponse(r.data, r.meta, base64_field="video", mime_field="mime_type")

    async def generate_video_async(
        self,
        name: str | None = None,
        *,
        prompt: str,
        model: str | None = None,
        aspect_ratio: str | None = None,
    ) -> MediaResponse:
        input_schema, input_data = _build_video_request(prompt, aspect_ratio)
        r = await self.call_async(
            name or "video-gen",
            input=input_data,
            input_schema=input_schema,
            output_schema=_video_output_schema(),
            model=model,
        )
        return MediaResponse(r.data, r.meta, base64_field="video", mime_field="mime_type")

    def text_to_speech(
        self,
        name: str | None = None,
        *,
        text: str,
        voice: str | None = None,
        model: str | None = None,
    ) -> MediaResponse:
        input_schema, input_data = _build_tts_request(text, voice)
        r = self.call(
            name or "tts",
            input=input_data,
            input_schema=input_schema,
            output_schema=_tts_output_schema(),
            model=model,
        )
        return MediaResponse(r.data, r.meta, base64_field="audio", mime_field="mime_type")

    async def text_to_speech_async(
        self,
        name: str | None = None,
        *,
        text: str,
        voice: str | None = None,
        model: str | None = None,
    ) -> MediaResponse:
        input_schema, input_data = _build_tts_request(text, voice)
        r = await self.call_async(
            name or "tts",
            input=input_data,
            input_schema=input_schema,
            output_schema=_tts_output_schema(),
            model=model,
        )
        return MediaResponse(r.data, r.meta, base64_field="audio", mime_field="mime_type")

    def transcribe(
        self,
        name: str | None = None,
        *,
        audio: str | bytes,
        language: str | None = None,
        prompt: str | None = None,
        model: str | None = None,
    ) -> RunResponse:
        input_schema, input_data = _build_stt_request(audio, language, prompt)
        return self.call(
            name or "stt",
            input=input_data,
            input_schema=input_schema,
            output_schema=_stt_output_schema(),
            model=model,
        )

    async def transcribe_async(
        self,
        name: str | None = None,
        *,
        audio: str | bytes,
        language: str | None = None,
        prompt: str | None = None,
        model: str | None = None,
    ) -> RunResponse:
        input_schema, input_data = _build_stt_request(audio, language, prompt)
        return await self.call_async(
            name or "stt",
            input=input_data,
            input_schema=input_schema,
            output_schema=_stt_output_schema(),
            model=model,
        )

    # --- Internal helpers -----------------------------------------------------

    def _build_request(
        self,
        *,
        input: Any,
        input_schema: Any = None,
        output_schema: Any = None,
        instructions: str | None = None,
        model: str | None = None,
        parent_span_id: str | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Build a RunRequest dict, resolving schemas and trace context."""
        request: dict[str, Any] = {"input": _serialize_value(input)}

        resolved_input_schema = resolve_schema(input_schema)
        if resolved_input_schema is not None:
            request["input_schema"] = resolved_input_schema

        resolved_output_schema = resolve_schema(output_schema)
        if resolved_output_schema is not None:
            request["output_schema"] = resolved_output_schema

        if instructions is not None:
            request["instructions"] = instructions
        if model is not None:
            request["model"] = model

        # Resolve parent_span_id from trace context if not explicitly provided
        if parent_span_id is not None:
            request["parent_span_id"] = parent_span_id
        else:
            ctx = get_trace_context()
            if ctx is not None:
                request["parent_span_id"] = ctx.span_id

        if tools is not None:
            resolved_tools = []
            for tool in tools:
                t = dict(tool)
                if "parameters" in t:
                    resolved_params = resolve_schema(t["parameters"])
                    if resolved_params is not None:
                        t["parameters"] = resolved_params
                resolved_tools.append(t)
            request["tools"] = resolved_tools

        return request


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_value(value: Any) -> Any:
    """Convert Pydantic models and dataclasses to JSON-serializable dicts."""
    import dataclasses

    # Pydantic BaseModel instance (detected without importing pydantic)
    if hasattr(value, "model_dump"):
        return value.model_dump()
    # dataclass instance
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return dataclasses.asdict(value)
    return value


def _quote(name: str) -> str:
    from urllib.parse import quote

    return quote(name, safe="")


def _resolve_media_input(value: str | bytes) -> str:
    """Resolve a media input to a base64 string. Accepts base64 string, bytes, or file path."""
    if isinstance(value, bytes):
        import base64

        return base64.b64encode(value).decode()
    # If it looks like a file path (not already base64), read it
    if len(value) < 500 and ("/" in value or "\\" in value or "." in value):
        import base64
        from pathlib import Path

        p = Path(value)
        if p.exists():
            return base64.b64encode(p.read_bytes()).decode()
    return value


def _build_image_request(
    prompt: str,
    reference_image: str | bytes | None = None,
    size: str | None = None,
    quality: str | None = None,
    style: str | None = None,
    n: int | None = None,
    mime_type: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build input_schema and input for image generation, matching the TS SDK."""
    props: dict[str, Any] = {"description": {"type": "string", "description": "Text description of the image"}}
    values: dict[str, Any] = {"description": prompt}

    if reference_image is not None:
        props["reference_image"] = {"type": "string", "description": "Base64-encoded reference image"}
        values["reference_image"] = _resolve_media_input(reference_image)
    if size is not None:
        props["size"] = {"type": "string", "description": "Image size"}
        values["size"] = size
    if quality is not None:
        props["quality"] = {"type": "string", "description": "Image quality"}
        values["quality"] = quality
    if style is not None:
        props["style"] = {"type": "string", "description": "Image style"}
        values["style"] = style
    if n is not None:
        props["n"] = {"type": "number", "description": "Number of images"}
        values["n"] = n
    if mime_type is not None:
        props["mime_type"] = {"type": "string", "description": "Requested output MIME type"}
        values["mime_type"] = mime_type

    schema = {"type": "object", "properties": props, "required": ["description"]}
    return schema, values


def _build_video_request(
    prompt: str,
    aspect_ratio: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build input_schema and input for video generation."""
    props: dict[str, Any] = {"prompt": {"type": "string", "description": "Text description of the video"}}
    values: dict[str, Any] = {"prompt": prompt}

    if aspect_ratio is not None:
        props["aspect_ratio"] = {"type": "string", "description": "Output aspect ratio"}
        values["aspect_ratio"] = aspect_ratio

    schema = {"type": "object", "properties": props, "required": ["prompt"]}
    return schema, values


def _build_tts_request(
    text: str,
    voice: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build input_schema and input for text-to-speech."""
    props: dict[str, Any] = {"text": {"type": "string", "description": "Text to convert to speech"}}
    values: dict[str, Any] = {"text": text}

    if voice is not None:
        props["voice"] = {"type": "string", "description": "Voice ID"}
        values["voice"] = voice

    schema = {"type": "object", "properties": props, "required": ["text"]}
    return schema, values


def _build_stt_request(
    audio: str | bytes,
    language: str | None = None,
    prompt: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build input_schema and input for speech-to-text."""
    props: dict[str, Any] = {"audio": {"type": "string", "description": "Base64-encoded audio"}}
    values: dict[str, Any] = {"audio": _resolve_media_input(audio)}

    if language is not None:
        props["language"] = {"type": "string", "description": "Language code"}
        values["language"] = language
    if prompt is not None:
        props["prompt"] = {"type": "string", "description": "Optional prompt"}
        values["prompt"] = prompt

    schema = {"type": "object", "properties": props, "required": ["audio"]}
    return schema, values


def _image_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "image": {"type": "string", "description": "Base64-encoded image data"},
            "mime_type": {"type": "string", "description": "MIME type of the generated image"},
        },
        "required": ["image", "mime_type"],
    }


def _video_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "video": {"type": "string", "description": "Base64-encoded video data"},
            "mime_type": {"type": "string", "description": "MIME type of the generated video"},
        },
        "required": ["video", "mime_type"],
    }


def _tts_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "audio": {"type": "string", "description": "Base64-encoded audio data"},
            "mime_type": {"type": "string", "description": "MIME type of the generated audio"},
        },
        "required": ["audio", "mime_type"],
    }


def _stt_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Transcribed text"},
        },
        "required": ["text"],
    }
