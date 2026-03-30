"""Tests for BaseClient HTTP layer and error mapping."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from opperai._base_client import BaseClient
from opperai.types import (
    ApiError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    NotFoundError,
    RateLimitError,
)


def _mock_response(status: int, body: dict | str | None = None, reason: str = "") -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status
    resp.reason_phrase = reason
    resp.is_success = 200 <= status < 300
    resp.headers = {}
    if isinstance(body, dict):
        resp.json.return_value = body
        resp.text = json.dumps(body)
    elif isinstance(body, str):
        resp.json.side_effect = json.JSONDecodeError("", "", 0)
        resp.text = body
    else:
        resp.json.side_effect = json.JSONDecodeError("", "", 0)
        resp.text = ""
    return resp


class TestRaiseForStatus:
    def test_success_does_not_raise(self) -> None:
        resp = _mock_response(200, {"ok": True})
        BaseClient._raise_for_status(resp)

    def test_400_raises_bad_request(self) -> None:
        resp = _mock_response(400, {"error": {"code": "invalid", "message": "bad"}}, "Bad Request")
        with pytest.raises(BadRequestError) as exc_info:
            BaseClient._raise_for_status(resp)
        assert exc_info.value.status == 400

    def test_401_raises_authentication_error(self) -> None:
        resp = _mock_response(401, None, "Unauthorized")
        with pytest.raises(AuthenticationError):
            BaseClient._raise_for_status(resp)

    def test_404_raises_not_found(self) -> None:
        resp = _mock_response(404, None, "Not Found")
        with pytest.raises(NotFoundError):
            BaseClient._raise_for_status(resp)

    def test_429_raises_rate_limit(self) -> None:
        resp = _mock_response(429, None, "Too Many Requests")
        with pytest.raises(RateLimitError):
            BaseClient._raise_for_status(resp)

    def test_500_raises_internal_server_error(self) -> None:
        resp = _mock_response(500, None, "Internal Server Error")
        with pytest.raises(InternalServerError):
            BaseClient._raise_for_status(resp)

    def test_unknown_status_raises_api_error(self) -> None:
        resp = _mock_response(503, None, "Service Unavailable")
        with pytest.raises(ApiError) as exc_info:
            BaseClient._raise_for_status(resp)
        assert exc_info.value.status == 503
        assert not isinstance(exc_info.value, BadRequestError)

    def test_json_body_is_parsed(self) -> None:
        body = {"error": {"code": "invalid", "message": "bad input"}}
        resp = _mock_response(400, body, "Bad Request")
        with pytest.raises(BadRequestError) as exc_info:
            BaseClient._raise_for_status(resp)
        assert exc_info.value.body == body

    def test_text_body_fallback(self) -> None:
        resp = _mock_response(500, "plain text error", "Internal Server Error")
        with pytest.raises(InternalServerError) as exc_info:
            BaseClient._raise_for_status(resp)
        assert exc_info.value.body == "plain text error"


class TestParseResponse:
    def test_204_returns_none(self) -> None:
        resp = _mock_response(204)
        assert BaseClient._parse_response(resp) is None

    def test_empty_text_returns_none(self) -> None:
        resp = _mock_response(200)
        resp.text = ""
        assert BaseClient._parse_response(resp) is None

    def test_json_text_parsed(self) -> None:
        resp = _mock_response(200)
        resp.text = '{"key": "value"}'
        assert BaseClient._parse_response(resp) == {"key": "value"}


class TestSyncRequest:
    def test_get_calls_client(self, base_client: BaseClient) -> None:
        mock_resp = _mock_response(200, {"data": "ok"})
        base_client._sync_client.request.return_value = mock_resp  # type: ignore[union-attr]
        result = base_client._get("/test")
        assert result == {"data": "ok"}
        base_client._sync_client.request.assert_called_once()  # type: ignore[union-attr]

    def test_post_sends_json_body(self, base_client: BaseClient) -> None:
        mock_resp = _mock_response(200, {"result": 1})
        base_client._sync_client.request.return_value = mock_resp  # type: ignore[union-attr]
        result = base_client._post("/test", {"input": "hello"})
        assert result == {"result": 1}
        call_kwargs = base_client._sync_client.request.call_args  # type: ignore[union-attr]
        assert json.loads(call_kwargs.kwargs["content"]) == {"input": "hello"}

    def test_307_redirect_preserves_body(self, base_client: BaseClient) -> None:
        redirect_resp = _mock_response(307)
        redirect_resp.status_code = 307
        redirect_resp.is_success = False
        redirect_resp.headers = {"location": "https://redirect.example.com/new"}
        final_resp = _mock_response(200, {"redirected": True})
        base_client._sync_client.request.side_effect = [redirect_resp, final_resp]  # type: ignore[union-attr]
        result = base_client._post("/test", {"body": "data"})
        assert result == {"redirected": True}
        assert base_client._sync_client.request.call_count == 2  # type: ignore[union-attr]

    def test_query_params_filter_none(self, base_client: BaseClient) -> None:
        mock_resp = _mock_response(200, {"data": []})
        base_client._sync_client.request.return_value = mock_resp  # type: ignore[union-attr]
        base_client._get("/test", query={"a": 1, "b": None, "c": "x"})
        call_kwargs = base_client._sync_client.request.call_args  # type: ignore[union-attr]
        assert call_kwargs.kwargs["params"] == {"a": 1, "c": "x"}


class TestAsyncRequest:
    async def test_get_async(self, base_client: BaseClient) -> None:
        mock_resp = _mock_response(200, {"data": "ok"})
        base_client._async_client.request.return_value = mock_resp  # type: ignore[union-attr]
        result = await base_client._get_async("/test")
        assert result == {"data": "ok"}

    async def test_post_async_sends_body(self, base_client: BaseClient) -> None:
        mock_resp = _mock_response(200, {"result": 1})
        base_client._async_client.request.return_value = mock_resp  # type: ignore[union-attr]
        result = await base_client._post_async("/test", {"input": "hi"})
        assert result == {"result": 1}

    async def test_307_redirect_async(self, base_client: BaseClient) -> None:
        redirect_resp = _mock_response(307)
        redirect_resp.status_code = 307
        redirect_resp.is_success = False
        redirect_resp.headers = {"location": "https://redirect.example.com/new"}
        final_resp = _mock_response(200, {"redirected": True})
        base_client._async_client.request.side_effect = [redirect_resp, final_resp]  # type: ignore[union-attr]
        result = await base_client._post_async("/test", {"body": "data"})
        assert result == {"redirected": True}
