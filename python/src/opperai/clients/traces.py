"""Opper SDK — Traces Client."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .._base_client import BaseClient
from ..types import (
    GetTraceResponse,
    ListTracesItem,
    ListTracesResponse,
    RequestOptions,
    TraceSpan,
)


class TracesClient:
    """Client for the Traces API endpoints."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def list(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
        name: str | None = None,
        options: RequestOptions | None = None,
    ) -> ListTracesResponse:
        query: dict[str, Any] = {}
        if limit is not None:
            query["limit"] = limit
        if offset is not None:
            query["offset"] = offset
        if name is not None:
            query["name"] = name
        data = self._client._get("/v3/traces", query=query, options=options)
        items = [ListTracesItem(**item) for item in (data or {}).get("data", [])]
        meta = (data or {}).get("meta", {})
        return ListTracesResponse(data=items, meta=meta)

    async def list_async(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
        name: str | None = None,
        options: RequestOptions | None = None,
    ) -> ListTracesResponse:
        query: dict[str, Any] = {}
        if limit is not None:
            query["limit"] = limit
        if offset is not None:
            query["offset"] = offset
        if name is not None:
            query["name"] = name
        data = await self._client._get_async("/v3/traces", query=query, options=options)
        items = [ListTracesItem(**item) for item in (data or {}).get("data", [])]
        meta = (data or {}).get("meta", {})
        return ListTracesResponse(data=items, meta=meta)

    def get(self, id: str, *, options: RequestOptions | None = None) -> GetTraceResponse:
        data = self._client._get(f"/v3/traces/{quote(id, safe='')}", options=options)
        spans = [TraceSpan(**s) for s in (data or {}).get("spans", [])]
        return GetTraceResponse(
            id=data.get("id", ""),
            name=data.get("name"),
            span_count=data.get("span_count", 0),
            spans=spans,
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            duration_ms=data.get("duration_ms"),
            status=data.get("status"),
        )

    async def get_async(self, id: str, *, options: RequestOptions | None = None) -> GetTraceResponse:
        data = await self._client._get_async(f"/v3/traces/{quote(id, safe='')}", options=options)
        spans = [TraceSpan(**s) for s in (data or {}).get("spans", [])]
        return GetTraceResponse(
            id=data.get("id", ""),
            name=data.get("name"),
            span_count=data.get("span_count", 0),
            spans=spans,
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            duration_ms=data.get("duration_ms"),
            status=data.get("status"),
        )

    def delete(self, id: str, *, options: RequestOptions | None = None) -> None:
        self._client._delete(f"/v3/traces/{quote(id, safe='')}", options=options)

    async def delete_async(self, id: str, *, options: RequestOptions | None = None) -> None:
        await self._client._delete_async(f"/v3/traces/{quote(id, safe='')}", options=options)
