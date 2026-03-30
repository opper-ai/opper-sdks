"""Opper SDK — Functions Client."""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from typing import Any
from urllib.parse import quote

from .._base_client import BaseClient
from ..types import (
    FunctionDetails,
    FunctionInfo,
    FunctionRevision,
    RealtimeCreateResponse,
    RequestOptions,
    RevisionInfo,
    RunResponse,
    StreamChunk,
)


class FunctionsClient:
    """Client for the Functions API endpoints."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    @staticmethod
    def _fn_path(name: str) -> str:
        return f"/v3/functions/{quote(name, safe='')}"

    # --- List / Get / Update / Delete -----------------------------------------

    def list(self, *, options: RequestOptions | None = None) -> list[FunctionInfo]:
        data = self._client._get("/v3/functions", options=options)
        return [FunctionInfo(**f) for f in (data or {}).get("functions", [])]

    async def list_async(self, *, options: RequestOptions | None = None) -> list[FunctionInfo]:
        data = await self._client._get_async("/v3/functions", options=options)
        return [FunctionInfo(**f) for f in (data or {}).get("functions", [])]

    def get(self, name: str, *, options: RequestOptions | None = None) -> FunctionDetails:
        data = self._client._get(self._fn_path(name), options=options)
        return FunctionDetails(**data)

    async def get_async(self, name: str, *, options: RequestOptions | None = None) -> FunctionDetails:
        data = await self._client._get_async(self._fn_path(name), options=options)
        return FunctionDetails(**data)

    def update(self, name: str, *, source: str, options: RequestOptions | None = None) -> FunctionDetails:
        data = self._client._put(self._fn_path(name), {"source": source}, options=options)
        return FunctionDetails(**data)

    async def update_async(self, name: str, *, source: str, options: RequestOptions | None = None) -> FunctionDetails:
        data = await self._client._put_async(self._fn_path(name), {"source": source}, options=options)
        return FunctionDetails(**data)

    def delete(self, name: str, *, options: RequestOptions | None = None) -> None:
        self._client._delete(self._fn_path(name), options=options)

    async def delete_async(self, name: str, *, options: RequestOptions | None = None) -> None:
        await self._client._delete_async(self._fn_path(name), options=options)

    # --- Execute --------------------------------------------------------------

    def run(self, name: str, request: dict[str, Any], *, options: RequestOptions | None = None) -> RunResponse:
        data = self._client._post(f"{self._fn_path(name)}/call", request, options=options)
        return RunResponse(data=data.get("data"), meta=data.get("meta"))

    async def run_async(
        self, name: str, request: dict[str, Any], *, options: RequestOptions | None = None
    ) -> RunResponse:
        data = await self._client._post_async(f"{self._fn_path(name)}/call", request, options=options)
        return RunResponse(data=data.get("data"), meta=data.get("meta"))

    def stream(
        self, name: str, request: dict[str, Any], *, options: RequestOptions | None = None
    ) -> Iterator[StreamChunk]:
        return self._client._stream_sse(f"{self._fn_path(name)}/stream", request, options=options)

    async def stream_async(
        self, name: str, request: dict[str, Any], *, options: RequestOptions | None = None
    ) -> AsyncIterator[StreamChunk]:
        return self._client._stream_sse_async(f"{self._fn_path(name)}/stream", request, options=options)

    # --- Realtime -------------------------------------------------------------

    def create_realtime(
        self,
        name: str,
        *,
        instructions: str,
        model: str | None = None,
        provider: str | None = None,
        voice: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        options: RequestOptions | None = None,
    ) -> RealtimeCreateResponse:
        body: dict[str, Any] = {"instructions": instructions}
        if model is not None:
            body["model"] = model
        if provider is not None:
            body["provider"] = provider
        if voice is not None:
            body["voice"] = voice
        if tools is not None:
            body["tools"] = tools
        data = self._client._post(f"{self._fn_path(name)}/realtime", body, options=options)
        return RealtimeCreateResponse(**data)

    async def create_realtime_async(
        self,
        name: str,
        *,
        instructions: str,
        model: str | None = None,
        provider: str | None = None,
        voice: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        options: RequestOptions | None = None,
    ) -> RealtimeCreateResponse:
        body: dict[str, Any] = {"instructions": instructions}
        if model is not None:
            body["model"] = model
        if provider is not None:
            body["provider"] = provider
        if voice is not None:
            body["voice"] = voice
        if tools is not None:
            body["tools"] = tools
        data = await self._client._post_async(f"{self._fn_path(name)}/realtime", body, options=options)
        return RealtimeCreateResponse(**data)

    def get_realtime_ws_url(self, name: str) -> str:
        base = self._client._base_url
        scheme = "wss" if base.startswith("https") else "ws"
        host = base.replace("https://", "").replace("http://", "")
        return f"{scheme}://{host}/v3/realtime/{quote(name, safe='')}"

    # --- Revisions ------------------------------------------------------------

    def list_revisions(self, name: str, *, options: RequestOptions | None = None) -> list[RevisionInfo]:
        data = self._client._get(f"{self._fn_path(name)}/revisions", options=options)
        return [RevisionInfo(**r) for r in (data or {}).get("revisions", [])]

    async def list_revisions_async(self, name: str, *, options: RequestOptions | None = None) -> list[RevisionInfo]:
        data = await self._client._get_async(f"{self._fn_path(name)}/revisions", options=options)
        return [RevisionInfo(**r) for r in (data or {}).get("revisions", [])]

    def get_revision(self, name: str, revision_id: int, *, options: RequestOptions | None = None) -> FunctionRevision:
        data = self._client._get(f"{self._fn_path(name)}/revisions/{revision_id}", options=options)
        return FunctionRevision(**data)

    async def get_revision_async(
        self, name: str, revision_id: int, *, options: RequestOptions | None = None
    ) -> FunctionRevision:
        data = await self._client._get_async(f"{self._fn_path(name)}/revisions/{revision_id}", options=options)
        return FunctionRevision(**data)

    def revert_revision(self, name: str, revision_id: int, *, options: RequestOptions | None = None) -> FunctionDetails:
        data = self._client._post(f"{self._fn_path(name)}/revisions/{revision_id}/revert", options=options)
        return FunctionDetails(**data)

    async def revert_revision_async(
        self, name: str, revision_id: int, *, options: RequestOptions | None = None
    ) -> FunctionDetails:
        data = await self._client._post_async(f"{self._fn_path(name)}/revisions/{revision_id}/revert", options=options)
        return FunctionDetails(**data)

    # --- Examples -------------------------------------------------------------

    def create_example(
        self,
        name: str,
        *,
        input: dict[str, Any],
        output: dict[str, Any],
        tag: str | None = None,
        options: RequestOptions | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"input": input, "output": output}
        if tag is not None:
            body["tag"] = tag
        return self._client._post(f"{self._fn_path(name)}/examples", body, options=options)

    async def create_example_async(
        self,
        name: str,
        *,
        input: dict[str, Any],
        output: dict[str, Any],
        tag: str | None = None,
        options: RequestOptions | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"input": input, "output": output}
        if tag is not None:
            body["tag"] = tag
        return await self._client._post_async(f"{self._fn_path(name)}/examples", body, options=options)

    def create_examples_batch(
        self,
        name: str,
        examples: list[dict[str, Any]],
        *,
        options: RequestOptions | None = None,
    ) -> dict[str, Any]:
        return self._client._post(f"{self._fn_path(name)}/examples/batch", examples, options=options)

    async def create_examples_batch_async(
        self,
        name: str,
        examples: list[dict[str, Any]],
        *,
        options: RequestOptions | None = None,
    ) -> dict[str, Any]:
        return await self._client._post_async(f"{self._fn_path(name)}/examples/batch", examples, options=options)

    def list_examples(
        self,
        name: str,
        *,
        limit: int | None = None,
        offset: int | None = None,
        tag: str | None = None,
        options: RequestOptions | None = None,
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if limit is not None:
            query["limit"] = limit
        if offset is not None:
            query["offset"] = offset
        if tag is not None:
            query["tag"] = tag
        data = self._client._get(f"{self._fn_path(name)}/examples", query=query, options=options)
        return (data or {}).get("examples", [])

    async def list_examples_async(
        self,
        name: str,
        *,
        limit: int | None = None,
        offset: int | None = None,
        tag: str | None = None,
        options: RequestOptions | None = None,
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if limit is not None:
            query["limit"] = limit
        if offset is not None:
            query["offset"] = offset
        if tag is not None:
            query["tag"] = tag
        data = await self._client._get_async(f"{self._fn_path(name)}/examples", query=query, options=options)
        return (data or {}).get("examples", [])

    def delete_example(self, name: str, uuid: str, *, options: RequestOptions | None = None) -> None:
        self._client._delete(f"{self._fn_path(name)}/examples/{quote(uuid, safe='')}", options=options)

    async def delete_example_async(self, name: str, uuid: str, *, options: RequestOptions | None = None) -> None:
        await self._client._delete_async(f"{self._fn_path(name)}/examples/{quote(uuid, safe='')}", options=options)
