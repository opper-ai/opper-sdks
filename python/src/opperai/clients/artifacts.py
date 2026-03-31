"""Opper SDK — Artifacts Client."""

from __future__ import annotations

from urllib.parse import quote

from .._base_client import BaseClient
from ..types import ArtifactStatus, RequestOptions


class ArtifactsClient:
    """Client for the Artifacts API endpoints."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def get_status(self, id: str, *, options: RequestOptions | None = None) -> ArtifactStatus:
        """Poll for async artifact generation status.

        GET /v3/artifacts/:id/status
        """
        data = self._client._get(f"/v3/artifacts/{quote(id, safe='')}/status", options=options)
        return ArtifactStatus(
            id=(data or {}).get("id", ""),
            status=(data or {}).get("status", ""),
            url=(data or {}).get("url"),
            mime_type=(data or {}).get("mime_type"),
            error=(data or {}).get("error"),
        )

    async def get_status_async(self, id: str, *, options: RequestOptions | None = None) -> ArtifactStatus:
        """Poll for async artifact generation status (async).

        GET /v3/artifacts/:id/status
        """
        data = await self._client._get_async(f"/v3/artifacts/{quote(id, safe='')}/status", options=options)
        return ArtifactStatus(
            id=(data or {}).get("id", ""),
            status=(data or {}).get("status", ""),
            url=(data or {}).get("url"),
            mime_type=(data or {}).get("mime_type"),
            error=(data or {}).get("error"),
        )
