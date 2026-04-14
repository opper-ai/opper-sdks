"""OpenResponses client — HTTP client for POST /v3/compat/openresponses."""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from typing import Any

from .._base_client import BaseClient
from ..types import RequestOptions

ENDPOINT = "/v3/compat/openresponses"


class OpenResponsesClient:
    """Client for the OpenResponses endpoint.

    Provides four methods:
    - ``create()`` / ``create_async()`` — non-streaming, returns the full response dict
    - ``create_stream()`` / ``create_stream_async()`` — streaming, yields raw SSE event dicts
    """

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    # --- Non-streaming --------------------------------------------------------

    def create(
        self,
        request: dict[str, Any],
        options: RequestOptions | None = None,
    ) -> dict[str, Any]:
        """Send a non-streaming request. Returns the complete ORResponse dict."""
        return self._client._post(
            ENDPOINT,
            body={**request, "stream": False},
            options=options,
        )

    async def create_async(
        self,
        request: dict[str, Any],
        options: RequestOptions | None = None,
    ) -> dict[str, Any]:
        """Send a non-streaming request (async). Returns the complete ORResponse dict."""
        return await self._client._post_async(
            ENDPOINT,
            body={**request, "stream": False},
            options=options,
        )

    # --- Streaming ------------------------------------------------------------

    def create_stream(
        self,
        request: dict[str, Any],
        options: RequestOptions | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Send a streaming request. Yields raw SSE event dicts.

        The event type is in the ``type`` field of each dict, e.g.
        ``"response.output_text.delta"``, ``"response.completed"``, etc.
        """
        return self._client._stream_sse_raw(
            ENDPOINT,
            body={**request, "stream": True},
            options=options,
        )

    async def create_stream_async(
        self,
        request: dict[str, Any],
        options: RequestOptions | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Send a streaming request (async). Yields raw SSE event dicts."""
        return self._client._stream_sse_raw_async(
            ENDPOINT,
            body={**request, "stream": True},
            options=options,
        )
