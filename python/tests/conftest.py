"""Shared fixtures for Opper SDK tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from opperai._base_client import BaseClient
from opperai._client import Opper


@pytest.fixture
def base_client() -> BaseClient:
    """A BaseClient with mocked sync/async httpx clients."""
    client = BaseClient("test-api-key", "https://api.opper.ai")
    client._sync_client = MagicMock()
    client._async_client = AsyncMock()
    return client


@pytest.fixture
def opper(monkeypatch: pytest.MonkeyPatch) -> Opper:
    """An Opper instance with all HTTP calls mocked at the BaseClient level."""
    monkeypatch.setenv("OPPER_API_KEY", "test-api-key")
    o = Opper()
    # Mock all low-level HTTP methods
    o._client._get = MagicMock()  # type: ignore[method-assign]
    o._client._post = MagicMock()  # type: ignore[method-assign]
    o._client._put = MagicMock()  # type: ignore[method-assign]
    o._client._patch = MagicMock()  # type: ignore[method-assign]
    o._client._delete = MagicMock()  # type: ignore[method-assign]
    o._client._upload = MagicMock()  # type: ignore[method-assign]
    o._client._get_async = AsyncMock()  # type: ignore[method-assign]
    o._client._post_async = AsyncMock()  # type: ignore[method-assign]
    o._client._put_async = AsyncMock()  # type: ignore[method-assign]
    o._client._patch_async = AsyncMock()  # type: ignore[method-assign]
    o._client._delete_async = AsyncMock()  # type: ignore[method-assign]
    o._client._upload_async = AsyncMock()  # type: ignore[method-assign]
    o._client._stream_sse = MagicMock()  # type: ignore[method-assign]
    o._client._stream_sse_async = AsyncMock()  # type: ignore[method-assign]
    return o
