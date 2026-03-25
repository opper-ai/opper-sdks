"""Opper SDK — System Client."""

from __future__ import annotations

from .._base_client import BaseClient
from ..types import HealthResponse, RequestOptions


class SystemClient:
    """Client for the System API endpoints."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def health(self, *, options: RequestOptions | None = None) -> HealthResponse:
        data = self._client._get("/health", options=options)
        return HealthResponse(status=(data or {}).get("status", ""))

    async def health_async(self, *, options: RequestOptions | None = None) -> HealthResponse:
        data = await self._client._get_async("/health", options=options)
        return HealthResponse(status=(data or {}).get("status", ""))
