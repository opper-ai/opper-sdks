"""Opper SDK — Web Tools Client (Beta)."""

from __future__ import annotations

from .._base_client import BaseClient
from .._beta import beta
from ..types import RequestOptions, WebFetchResponse, WebSearchResponse, WebSearchResult, _from_dict


class WebToolsClient:
    """Client for the Web Tools API endpoints (beta).

    These endpoints are marked ``x-beta: true`` in the OpenAPI spec. Request and
    response shapes may change without a major version bump. Exposed under
    ``opper.beta.web`` to reinforce this status.
    """

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    @beta
    def fetch(self, *, url: str, options: RequestOptions | None = None) -> WebFetchResponse:
        data = self._client._post("/v3/tools/web/fetch", {"url": url}, options=options)
        return WebFetchResponse(content=(data or {}).get("content", ""))

    @beta
    async def fetch_async(self, *, url: str, options: RequestOptions | None = None) -> WebFetchResponse:
        data = await self._client._post_async("/v3/tools/web/fetch", {"url": url}, options=options)
        return WebFetchResponse(content=(data or {}).get("content", ""))

    @beta
    def search(self, *, query: str, options: RequestOptions | None = None) -> WebSearchResponse:
        data = self._client._post("/v3/tools/web/search", {"query": query}, options=options)
        results = [_from_dict(WebSearchResult, r) for r in (data or {}).get("results", [])]
        return WebSearchResponse(results=results)

    @beta
    async def search_async(self, *, query: str, options: RequestOptions | None = None) -> WebSearchResponse:
        data = await self._client._post_async("/v3/tools/web/search", {"query": query}, options=options)
        results = [_from_dict(WebSearchResult, r) for r in (data or {}).get("results", [])]
        return WebSearchResponse(results=results)
