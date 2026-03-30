"""Tests for error types and error hierarchy."""

from __future__ import annotations

import pytest

from opperai import (
    ApiError,
    AuthenticationError,
    BadRequestError,
    ErrorDetail,
    InternalServerError,
    NotFoundError,
    RateLimitError,
)


class TestApiError:
    def test_constructs_with_status_and_body(self) -> None:
        err = ApiError(404, "Not Found", {"error": {"code": "not_found", "message": "not found"}})
        assert err.status == 404
        assert err.status_text == "Not Found"
        assert err.body == {"error": {"code": "not_found", "message": "not found"}}

    def test_extends_exception(self) -> None:
        assert isinstance(ApiError(500, "Internal Server Error"), Exception)

    def test_includes_api_message_in_str(self) -> None:
        err = ApiError(400, "Bad Request", {"error": {"code": "invalid_input", "message": "field 'name' is required"}})
        assert str(err) == "400 Bad Request: field 'name' is required"

    def test_fallback_when_no_structured_body(self) -> None:
        err = ApiError(401, "Unauthorized")
        assert str(err) == "401 Unauthorized"

    def test_error_property_parses_detail(self) -> None:
        err = ApiError(400, "Bad Request", {
            "error": {"code": "validation_error", "message": "bad input", "details": {"field": "name"}},
        })
        assert err.error is not None
        assert err.error["code"] == "validation_error"
        assert err.error["message"] == "bad input"
        assert err.error["details"] == {"field": "name"}

    def test_error_property_returns_none_for_non_structured(self) -> None:
        err = ApiError(500, "Internal Server Error", "something broke")
        assert err.error is None

    def test_parse_detail_static(self) -> None:
        detail = ApiError.parse_detail({"error": {"code": "x", "message": "y"}})
        assert detail is not None
        assert detail["code"] == "x"

    def test_parse_detail_returns_none_for_invalid(self) -> None:
        assert ApiError.parse_detail(None) is None
        assert ApiError.parse_detail("string") is None
        assert ApiError.parse_detail({"error": "not a dict"}) is None
        assert ApiError.parse_detail({"error": {"code": 123, "message": "m"}}) is None


class TestBadRequestError:
    def test_status_400(self) -> None:
        err = BadRequestError("Bad Request", {"error": {"code": "invalid", "message": "bad"}})
        assert err.status == 400
        assert isinstance(err, ApiError)
        assert isinstance(err, BadRequestError)


class TestAuthenticationError:
    def test_status_401(self) -> None:
        err = AuthenticationError("Unauthorized")
        assert err.status == 401
        assert isinstance(err, ApiError)


class TestNotFoundError:
    def test_status_404(self) -> None:
        err = NotFoundError("Not Found", {"error": {"code": "not_found", "message": "gone"}})
        assert err.status == 404
        assert isinstance(err, ApiError)


class TestRateLimitError:
    def test_status_429(self) -> None:
        err = RateLimitError("Too Many Requests", {"error": {"code": "rate_limit", "message": "slow down"}})
        assert err.status == 429
        assert isinstance(err, ApiError)


class TestInternalServerError:
    def test_status_500(self) -> None:
        err = InternalServerError("Internal Server Error")
        assert err.status == 500
        assert isinstance(err, ApiError)


class TestErrorHierarchy:
    def test_all_subclasses_are_api_errors(self) -> None:
        errors = [
            BadRequestError("Bad Request"),
            AuthenticationError("Unauthorized"),
            NotFoundError("Not Found"),
            RateLimitError("Too Many Requests"),
            InternalServerError("Internal Server Error"),
        ]
        for err in errors:
            assert isinstance(err, ApiError)
            assert isinstance(err, Exception)

    def test_typed_catch_pattern(self) -> None:
        with pytest.raises(RateLimitError) as exc_info:
            raise RateLimitError("Too Many Requests", {"error": {"code": "rate_limit", "message": "slow down"}})
        assert exc_info.value.status == 429
        assert exc_info.value.error is not None
        assert exc_info.value.error["code"] == "rate_limit"

    def test_catch_subclass_as_api_error(self) -> None:
        with pytest.raises(ApiError) as exc_info:
            raise NotFoundError("Not Found")
        assert exc_info.value.status == 404
