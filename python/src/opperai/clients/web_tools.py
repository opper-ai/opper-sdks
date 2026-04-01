"""Opper SDK — Web Tools Client (Beta)."""

from __future__ import annotations

from .._base_client import BaseClient
from ..types import RequestOptions, WebFetchResponse, WebSearchResponse, WebSearchResult, _from_dict


class WebToolsClient:
    """Client for the Web Tools API endpoints (beta)."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def fetch(self, *, url: str, options: RequestOptions | None = None) -> WebFetchResponse:
        data = self._client._post("/v3/beta/tools/web/fetch", {"url": url}, options=options)
        return WebFetchResponse(content=(data or {}).get("content", ""))

    async def fetch_async(self, *, url: str, options: RequestOptions | None = None) -> WebFetchResponse:
        data = await self._client._post_async("/v3/beta/tools/web/fetch", {"url": url}, options=options)
        return WebFetchResponse(content=(data or {}).get("content", ""))

    def search(self, *, query: str, options: RequestOptions | None = None) -> WebSearchResponse:
        data = self._client._post("/v3/beta/tools/web/search", {"query": query}, options=options)
        results = [_from_dict(WebSearchResult, r) for r in (data or {}).get("results", [])]
        return WebSearchResponse(results=results)

    async def search_async(self, *, query: str, options: RequestOptions | None = None) -> WebSearchResponse:
        data = await self._client._post_async("/v3/beta/tools/web/search", {"query": query}, options=options)
        results = [_from_dict(WebSearchResult, r) for r in (data or {}).get("results", [])]
        return WebSearchResponse(results=results)
