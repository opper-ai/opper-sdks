"""Tests for WebToolsClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import WebFetchResponse, WebSearchResponse


class TestWebTools:
    def test_fetch(self, opper: Opper) -> None:
        opper._client._post.return_value = {"content": "<html>hello</html>"}
        result = opper.beta.web.fetch(url="https://example.com")
        assert isinstance(result, WebFetchResponse)
        assert result.content == "<html>hello</html>"

    def test_search(self, opper: Opper) -> None:
        opper._client._post.return_value = {
            "results": [
                {"title": "Example", "url": "https://example.com", "snippet": "A page"},
            ]
        }
        result = opper.beta.web.search(query="example")
        assert isinstance(result, WebSearchResponse)
        assert len(result.results) == 1
        assert result.results[0].title == "Example"

    async def test_fetch_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"content": "fetched"}
        result = await opper.beta.web.fetch_async(url="https://example.com")
        assert result.content == "fetched"

    async def test_search_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"results": [{"title": "T", "url": "U", "snippet": "S"}]}
        result = await opper.beta.web.search_async(query="q")
        assert len(result.results) == 1
