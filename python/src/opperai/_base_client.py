"""Opper SDK — Base HTTP Client."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterator
from typing import Any

import httpx

from .types import (
    ApiError,
    CompleteChunk,
    ContentChunk,
    DoneChunk,
    ErrorChunk,
    RequestOptions,
    StreamChunk,
    ToolCallDeltaChunk,
    ToolCallStartChunk,
    UsageInfo,
)

DEFAULT_BASE_URL = "https://api.opper.ai"
DEFAULT_TIMEOUT = 120.0  # seconds


class BaseClient:
    """Low-level HTTP client with sync and async support, SSE streaming, and error handling."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        headers: dict[str, str] | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._default_headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            **(headers or {}),
        }
        self._sync_client: httpx.Client | None = None
        self._async_client: httpx.AsyncClient | None = None

    # --- Lazy client initialization -------------------------------------------

    def _get_sync_client(self) -> httpx.Client:
        if self._sync_client is None:
            self._sync_client = httpx.Client(
                base_url=self._base_url,
                headers=self._default_headers,
                timeout=DEFAULT_TIMEOUT,
            )
        return self._sync_client

    def _get_async_client(self) -> httpx.AsyncClient:
        if self._async_client is None:
            self._async_client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._default_headers,
                timeout=DEFAULT_TIMEOUT,
            )
        return self._async_client

    # --- Merge request options ------------------------------------------------

    def _merge_options(self, options: RequestOptions | None) -> dict[str, Any]:
        kwargs: dict[str, Any] = {}
        if options:
            if options.headers:
                kwargs["headers"] = options.headers
            if options.timeout is not None:
                kwargs["timeout"] = options.timeout
        return kwargs

    # --- Error handling -------------------------------------------------------

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.is_success:
            return
        try:
            body = response.json()
        except Exception:
            body = response.text or None
        raise ApiError(response.status_code, response.reason_phrase or "", body)

    @staticmethod
    def _parse_response(response: httpx.Response) -> Any:
        if response.status_code == 204:
            return None
        text = response.text
        if not text:
            return None
        return json.loads(text)

    # --- Sync HTTP methods ----------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        query: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> Any:
        client = self._get_sync_client()
        kwargs = self._merge_options(options)
        if body is not None:
            kwargs["content"] = json.dumps(body)
        if query:
            kwargs["params"] = {k: v for k, v in query.items() if v is not None}
        response = client.request(method, path, **kwargs)
        self._raise_for_status(response)
        return self._parse_response(response)

    def _get(self, path: str, query: dict[str, Any] | None = None, options: RequestOptions | None = None) -> Any:
        return self._request("GET", path, query=query, options=options)

    def _post(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return self._request("POST", path, body=body, options=options)

    def _put(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return self._request("PUT", path, body=body, options=options)

    def _patch(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return self._request("PATCH", path, body=body, options=options)

    def _delete(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return self._request("DELETE", path, body=body, options=options)

    def _upload(
        self,
        path: str,
        file: Any,
        *,
        filename: str | None = None,
        fields: dict[str, str] | None = None,
        options: RequestOptions | None = None,
    ) -> Any:
        """Multipart file upload."""
        client = self._get_sync_client()
        kwargs = self._merge_options(options)
        # Override content-type for multipart
        kwargs.setdefault("headers", {})
        kwargs["headers"].pop("Content-Type", None)
        files = {"file": (filename or "upload", file)}
        data = fields or {}
        response = client.post(
            path,
            files=files,
            data=data,
            headers={k: v for k, v in self._default_headers.items() if k != "Content-Type"},
            **{k: v for k, v in kwargs.items() if k != "headers"},
        )
        self._raise_for_status(response)
        return self._parse_response(response)

    # --- Async HTTP methods ---------------------------------------------------

    async def _request_async(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        query: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> Any:
        client = self._get_async_client()
        kwargs = self._merge_options(options)
        if body is not None:
            kwargs["content"] = json.dumps(body)
        if query:
            kwargs["params"] = {k: v for k, v in query.items() if v is not None}
        response = await client.request(method, path, **kwargs)
        self._raise_for_status(response)
        return self._parse_response(response)

    async def _get_async(
        self, path: str, query: dict[str, Any] | None = None, options: RequestOptions | None = None
    ) -> Any:
        return await self._request_async("GET", path, query=query, options=options)

    async def _post_async(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return await self._request_async("POST", path, body=body, options=options)

    async def _put_async(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return await self._request_async("PUT", path, body=body, options=options)

    async def _patch_async(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return await self._request_async("PATCH", path, body=body, options=options)

    async def _delete_async(self, path: str, body: Any = None, options: RequestOptions | None = None) -> Any:
        return await self._request_async("DELETE", path, body=body, options=options)

    async def _upload_async(
        self,
        path: str,
        file: Any,
        *,
        filename: str | None = None,
        fields: dict[str, str] | None = None,
        options: RequestOptions | None = None,
    ) -> Any:
        """Multipart file upload (async)."""
        client = self._get_async_client()
        kwargs = self._merge_options(options)
        kwargs.setdefault("headers", {})
        kwargs["headers"].pop("Content-Type", None)
        files = {"file": (filename or "upload", file)}
        data = fields or {}
        response = await client.post(
            path,
            files=files,
            data=data,
            headers={k: v for k, v in self._default_headers.items() if k != "Content-Type"},
            **{k: v for k, v in kwargs.items() if k != "headers"},
        )
        self._raise_for_status(response)
        return self._parse_response(response)

    # --- SSE Streaming --------------------------------------------------------

    def _stream_sse(
        self,
        path: str,
        body: Any = None,
        options: RequestOptions | None = None,
    ) -> Iterator[StreamChunk]:
        """POST request returning an SSE stream. Yields StreamChunk dataclass instances."""
        client = self._get_sync_client()
        kwargs = self._merge_options(options)
        headers = {**self._default_headers, "Accept": "text/event-stream", **(kwargs.get("headers") or {})}
        timeout = kwargs.get("timeout", DEFAULT_TIMEOUT)

        with client.stream(
            "POST",
            path,
            content=json.dumps(body) if body is not None else None,
            headers=headers,
            timeout=timeout,
        ) as response:
            self._raise_for_status(response)
            yield from _parse_sse_lines(response.iter_lines())

    async def _stream_sse_async(
        self,
        path: str,
        body: Any = None,
        options: RequestOptions | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """POST request returning an SSE stream (async). Yields StreamChunk dataclass instances."""
        client = self._get_async_client()
        kwargs = self._merge_options(options)
        headers = {**self._default_headers, "Accept": "text/event-stream", **(kwargs.get("headers") or {})}
        timeout = kwargs.get("timeout", DEFAULT_TIMEOUT)

        async with client.stream(
            "POST",
            path,
            content=json.dumps(body) if body is not None else None,
            headers=headers,
            timeout=timeout,
        ) as response:
            self._raise_for_status(response)
            async for chunk in _parse_sse_lines_async(response.aiter_lines()):
                yield chunk


# ---------------------------------------------------------------------------
# SSE parsing helpers
# ---------------------------------------------------------------------------


def _parse_chunk(data: dict[str, Any], event_type: str) -> StreamChunk | None:
    """Parse a JSON dict into the appropriate StreamChunk dataclass."""
    if event_type == "complete":
        return CompleteChunk(data=data.get("data"), meta=_parse_meta(data.get("meta")))

    chunk_type = data.get("type", "")

    if chunk_type == "content":
        return ContentChunk(delta=data.get("delta", ""))
    elif chunk_type == "tool_call_start":
        return ToolCallStartChunk(
            tool_call_index=data.get("tool_call_index", 0),
            tool_call_id=data.get("tool_call_id", ""),
            tool_call_name=data.get("tool_call_name", ""),
        )
    elif chunk_type == "tool_call_delta":
        return ToolCallDeltaChunk(
            tool_call_index=data.get("tool_call_index", 0),
            tool_call_args=data.get("tool_call_args", ""),
        )
    elif chunk_type == "done":
        usage_data = data.get("usage")
        usage = UsageInfo(**usage_data) if isinstance(usage_data, dict) else None
        return DoneChunk(usage=usage)
    elif chunk_type == "error":
        return ErrorChunk(error=data.get("error", ""))
    return None


def _parse_meta(meta_data: Any) -> Any:
    """Pass through meta data — full parsing would add complexity for little value at this layer."""
    return meta_data


def _parse_sse_lines(lines: Any) -> Iterator[StreamChunk]:
    """Parse SSE lines from a sync iterator."""
    current_event = ""
    for line in lines:
        stripped = line.strip()

        if not stripped:
            current_event = ""
            continue
        if stripped.startswith(":"):
            continue

        if stripped.startswith("event:"):
            current_event = stripped[6:].strip()
            continue

        if stripped.startswith("data:"):
            data_str = stripped[5:].strip()
            if data_str == "[DONE]":
                return
            if not data_str:
                continue
            try:
                parsed = json.loads(data_str)
                chunk = _parse_chunk(parsed, current_event)
                if chunk is not None:
                    yield chunk
            except json.JSONDecodeError:
                pass
            current_event = ""


async def _parse_sse_lines_async(lines: Any) -> AsyncIterator[StreamChunk]:
    """Parse SSE lines from an async iterator."""
    current_event = ""
    async for line in lines:
        stripped = line.strip()

        if not stripped:
            current_event = ""
            continue
        if stripped.startswith(":"):
            continue

        if stripped.startswith("event:"):
            current_event = stripped[6:].strip()
            continue

        if stripped.startswith("data:"):
            data_str = stripped[5:].strip()
            if data_str == "[DONE]":
                return
            if not data_str:
                continue
            try:
                parsed = json.loads(data_str)
                chunk = _parse_chunk(parsed, current_event)
                if chunk is not None:
                    yield chunk
            except json.JSONDecodeError:
                pass
            current_event = ""
