"""Opper SDK — Models Client."""

from __future__ import annotations

from typing import Any

from .._base_client import BaseClient
from ..types import ModelInfo, ModelsResponse, RequestOptions


class ModelsClient:
    """Client for the Models API endpoint."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def list(
        self,
        *,
        type: str | None = None,
        provider: str | None = None,
        q: str | None = None,
        capability: str | None = None,
        deprecated: bool | None = None,
        sort: str | None = None,
        order: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        options: RequestOptions | None = None,
    ) -> ModelsResponse:
        query: dict[str, Any] = {}
        for key, val in [
            ("type", type),
            ("provider", provider),
            ("q", q),
            ("capability", capability),
            ("deprecated", deprecated),
            ("sort", sort),
            ("order", order),
            ("limit", limit),
            ("offset", offset),
        ]:
            if val is not None:
                query[key] = val
        data = self._client._get("/v3/models", query=query, options=options)
        models = [ModelInfo(**m) for m in (data or {}).get("models", [])]
        return ModelsResponse(models=models)

    async def list_async(
        self,
        *,
        type: str | None = None,
        provider: str | None = None,
        q: str | None = None,
        capability: str | None = None,
        deprecated: bool | None = None,
        sort: str | None = None,
        order: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        options: RequestOptions | None = None,
    ) -> ModelsResponse:
        query: dict[str, Any] = {}
        for key, val in [
            ("type", type),
            ("provider", provider),
            ("q", q),
            ("capability", capability),
            ("deprecated", deprecated),
            ("sort", sort),
            ("order", order),
            ("limit", limit),
            ("offset", offset),
        ]:
            if val is not None:
                query[key] = val
        data = await self._client._get_async("/v3/models", query=query, options=options)
        models = [ModelInfo(**m) for m in (data or {}).get("models", [])]
        return ModelsResponse(models=models)
