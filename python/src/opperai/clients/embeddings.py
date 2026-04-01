"""Opper SDK — Embeddings Client."""

from __future__ import annotations

from typing import Any

from .._base_client import BaseClient
from ..types import EmbeddingsDataItem, EmbeddingsResponse, EmbeddingsUsageInfo, RequestOptions, _from_dict


class EmbeddingsClient:
    """Client for the Embeddings API endpoint (OpenAI-compatible)."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def create(
        self,
        *,
        input: str | list[str],
        model: str,
        dimensions: int | None = None,
        encoding_format: str | None = None,
        user: str | None = None,
        options: RequestOptions | None = None,
    ) -> EmbeddingsResponse:
        body: dict[str, Any] = {"input": input, "model": model}
        if dimensions is not None:
            body["dimensions"] = dimensions
        if encoding_format is not None:
            body["encoding_format"] = encoding_format
        if user is not None:
            body["user"] = user
        data = self._client._post("/v3/compat/embeddings", body, options=options)
        return _parse_embeddings_response(data)

    async def create_async(
        self,
        *,
        input: str | list[str],
        model: str,
        dimensions: int | None = None,
        encoding_format: str | None = None,
        user: str | None = None,
        options: RequestOptions | None = None,
    ) -> EmbeddingsResponse:
        body: dict[str, Any] = {"input": input, "model": model}
        if dimensions is not None:
            body["dimensions"] = dimensions
        if encoding_format is not None:
            body["encoding_format"] = encoding_format
        if user is not None:
            body["user"] = user
        data = await self._client._post_async("/v3/compat/embeddings", body, options=options)
        return _parse_embeddings_response(data)


def _parse_embeddings_response(data: dict[str, Any]) -> EmbeddingsResponse:
    items = [_from_dict(EmbeddingsDataItem, d) for d in data.get("data", [])]
    usage_raw = data.get("usage", {})
    usage = _from_dict(EmbeddingsUsageInfo, usage_raw) if usage_raw else EmbeddingsUsageInfo()
    return EmbeddingsResponse(
        object=data.get("object", ""),
        data=items,
        model=data.get("model", ""),
        usage=usage,
    )
