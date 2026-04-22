"""Tests for agent error visibility: empty streams, streaming-body error
reads, and fatal-error classification of 4xx responses."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import patch

import pytest

from opperai._base_client import BaseClient
from opperai.agent import Agent
from opperai.agent._errors import AgentError
from opperai.agent._loop import _is_fatal
from opperai.types import (
    ApiError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    NotFoundError,
    RateLimitError,
)

# ---------------------------------------------------------------------------
# Empty-stream guard in stream_loop
# ---------------------------------------------------------------------------


class _EmptyStream:
    """Async iterator that yields no events — simulates a stream that closes
    without any response.completed/failed/incomplete event."""

    async def __aiter__(self) -> AsyncIterator[dict[str, Any]]:
        if False:
            yield {}  # pragma: no cover


@pytest.mark.asyncio
async def test_empty_stream_raises_agent_error() -> None:
    agent = Agent(
        name="empty-stream-agent",
        instructions="...",
        tracing=False,
        client={"api_key": "test", "base_url": "http://test"},
    )

    async def _empty(*_a: Any, **_kw: Any) -> AsyncIterator[dict[str, Any]]:
        return _EmptyStream().__aiter__()

    with patch.object(agent._or_client, "create_stream_async", side_effect=_empty):
        with pytest.raises(AgentError, match="without a completion event"):
            await agent.run("hi")


# ---------------------------------------------------------------------------
# _is_fatal: 4xx (except 408/429) are fatal; 5xx and transient are not
# ---------------------------------------------------------------------------


class TestIsFatal:
    def test_400_bad_request_is_fatal(self) -> None:
        assert _is_fatal(BadRequestError("Bad Request", None)) is True

    def test_404_not_found_is_fatal(self) -> None:
        assert _is_fatal(NotFoundError("Not Found", None)) is True

    def test_401_authentication_is_fatal(self) -> None:
        assert _is_fatal(AuthenticationError("Unauthorized", None)) is True

    def test_generic_422_is_fatal(self) -> None:
        assert _is_fatal(ApiError(422, "Unprocessable Entity", None)) is True

    def test_408_request_timeout_is_not_fatal(self) -> None:
        assert _is_fatal(ApiError(408, "Request Timeout", None)) is False

    def test_429_rate_limit_is_not_fatal(self) -> None:
        assert _is_fatal(RateLimitError("Too Many Requests", None)) is False

    def test_500_internal_server_error_is_not_fatal(self) -> None:
        assert _is_fatal(InternalServerError("Internal Server Error", None)) is False

    def test_non_api_error_is_not_fatal(self) -> None:
        assert _is_fatal(ValueError("oops")) is False


# ---------------------------------------------------------------------------
# _raise_for_status tolerates streaming response bodies
# ---------------------------------------------------------------------------


class _StreamingErrorBody:
    """Mimics an httpx.Response from an unread streaming body: .json() and
    .text both raise unless .read() has been called first."""

    def __init__(self, status: int, body_bytes: bytes) -> None:
        self.status_code = status
        self.reason_phrase = "Bad Request" if status == 400 else ""
        self._body = body_bytes
        self._read = False

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300

    def read(self) -> bytes:
        self._read = True
        return self._body

    def json(self) -> Any:
        if not self._read:
            raise RuntimeError("ResponseNotRead")
        import json as _json

        return _json.loads(self._body.decode())

    @property
    def text(self) -> str:
        if not self._read:
            raise RuntimeError("ResponseNotRead")
        return self._body.decode()


def test_raise_for_status_does_not_crash_on_unread_streaming_body() -> None:
    # Body NOT read — the previous implementation would crash inside the
    # `except Exception` clause because `response.text` raises again. The
    # new implementation must fall back to None and still raise a typed
    # error with the status code preserved.
    fake = _StreamingErrorBody(400, b'{"error":{"code":"x","message":"bad"}}')
    with pytest.raises(BadRequestError):
        BaseClient._raise_for_status(fake)  # type: ignore[arg-type]


def test_raise_for_status_surfaces_error_message_once_body_is_read() -> None:
    # After the caller drains the body (what the base client now does for
    # streaming responses), the typed error carries the parsed message.
    fake = _StreamingErrorBody(400, b'{"error":{"code":"model_not_found","message":"bad model"}}')
    fake.read()  # simulates the streaming drain
    with pytest.raises(BadRequestError) as exc_info:
        BaseClient._raise_for_status(fake)  # type: ignore[arg-type]
    assert "bad model" in str(exc_info.value)
