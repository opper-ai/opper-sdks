"""Opper SDK — Spans Client."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .._base_client import BaseClient
from ..types import CreateSpanResponse, GetSpanResponse, RequestOptions


class SpansClient:
    """Client for the Spans API endpoints."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def create(
        self,
        *,
        name: str,
        trace_id: str | None = None,
        parent_id: str | None = None,
        type: str | None = None,
        input: str | None = None,
        output: str | None = None,
        error: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        meta: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> CreateSpanResponse:
        body: dict[str, Any] = {"name": name}
        for key, val in [
            ("trace_id", trace_id),
            ("parent_id", parent_id),
            ("type", type),
            ("input", input),
            ("output", output),
            ("error", error),
            ("start_time", start_time),
            ("end_time", end_time),
            ("meta", meta),
            ("metadata", metadata),
            ("tags", tags),
        ]:
            if val is not None:
                body[key] = val
        data = self._client._post("/v3/spans", body, options=options)
        return CreateSpanResponse(**data)

    async def create_async(
        self,
        *,
        name: str,
        trace_id: str | None = None,
        parent_id: str | None = None,
        type: str | None = None,
        input: str | None = None,
        output: str | None = None,
        error: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        meta: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> CreateSpanResponse:
        body: dict[str, Any] = {"name": name}
        for key, val in [
            ("trace_id", trace_id),
            ("parent_id", parent_id),
            ("type", type),
            ("input", input),
            ("output", output),
            ("error", error),
            ("start_time", start_time),
            ("end_time", end_time),
            ("meta", meta),
            ("metadata", metadata),
            ("tags", tags),
        ]:
            if val is not None:
                body[key] = val
        data = await self._client._post_async("/v3/spans", body, options=options)
        return CreateSpanResponse(**data)

    def update(
        self,
        id: str,
        *,
        output: str | None = None,
        error: str | None = None,
        end_time: str | None = None,
        meta: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> None:
        body: dict[str, Any] = {}
        for key, val in [
            ("output", output),
            ("error", error),
            ("end_time", end_time),
            ("meta", meta),
            ("metadata", metadata),
            ("tags", tags),
        ]:
            if val is not None:
                body[key] = val
        self._client._patch(f"/v3/spans/{quote(id, safe='')}", body, options=options)

    async def update_async(
        self,
        id: str,
        *,
        output: str | None = None,
        error: str | None = None,
        end_time: str | None = None,
        meta: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> None:
        body: dict[str, Any] = {}
        for key, val in [
            ("output", output),
            ("error", error),
            ("end_time", end_time),
            ("meta", meta),
            ("metadata", metadata),
            ("tags", tags),
        ]:
            if val is not None:
                body[key] = val
        await self._client._patch_async(f"/v3/spans/{quote(id, safe='')}", body, options=options)

    def get(self, id: str, *, options: RequestOptions | None = None) -> GetSpanResponse:
        data = self._client._get(f"/v3/spans/{quote(id, safe='')}", options=options)
        return GetSpanResponse(**data)

    async def get_async(self, id: str, *, options: RequestOptions | None = None) -> GetSpanResponse:
        data = await self._client._get_async(f"/v3/spans/{quote(id, safe='')}", options=options)
        return GetSpanResponse(**data)

    def delete(self, id: str, *, options: RequestOptions | None = None) -> None:
        self._client._delete(f"/v3/spans/{quote(id, safe='')}", options=options)

    async def delete_async(self, id: str, *, options: RequestOptions | None = None) -> None:
        await self._client._delete_async(f"/v3/spans/{quote(id, safe='')}", options=options)
