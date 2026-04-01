"""Opper SDK — Generations Client."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .._base_client import BaseClient
from ..types import GenerationsListMeta, GenerationsListResponse, RequestOptions, _from_dict


class GenerationsClient:
    """Client for the Generations API endpoints."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def list(
        self,
        *,
        query: str | None = None,
        page: int | None = None,
        page_size: int | None = None,
        options: RequestOptions | None = None,
    ) -> GenerationsListResponse:
        params: dict[str, Any] = {}
        if query is not None:
            params["query"] = query
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["page_size"] = page_size
        data = self._client._get("/v3/generations", query=params, options=options)
        meta_raw = (data or {}).get("meta", {})
        return GenerationsListResponse(
            data=(data or {}).get("data", []),
            meta=_from_dict(GenerationsListMeta, meta_raw) if meta_raw else GenerationsListMeta(),
        )

    async def list_async(
        self,
        *,
        query: str | None = None,
        page: int | None = None,
        page_size: int | None = None,
        options: RequestOptions | None = None,
    ) -> GenerationsListResponse:
        params: dict[str, Any] = {}
        if query is not None:
            params["query"] = query
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["page_size"] = page_size
        data = await self._client._get_async("/v3/generations", query=params, options=options)
        meta_raw = (data or {}).get("meta", {})
        return GenerationsListResponse(
            data=(data or {}).get("data", []),
            meta=_from_dict(GenerationsListMeta, meta_raw) if meta_raw else GenerationsListMeta(),
        )

    def get(self, id: str, *, options: RequestOptions | None = None) -> dict[str, Any]:
        return self._client._get(f"/v3/generations/{quote(id, safe='')}", options=options)

    async def get_async(self, id: str, *, options: RequestOptions | None = None) -> dict[str, Any]:
        return await self._client._get_async(f"/v3/generations/{quote(id, safe='')}", options=options)

    def delete(self, id: str, *, options: RequestOptions | None = None) -> dict[str, Any]:
        return self._client._delete(f"/v3/generations/{quote(id, safe='')}", options=options)

    async def delete_async(self, id: str, *, options: RequestOptions | None = None) -> dict[str, Any]:
        return await self._client._delete_async(f"/v3/generations/{quote(id, safe='')}", options=options)
