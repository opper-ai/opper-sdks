"""Tests for RealtimeClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import RealtimeSession


class TestRealtimeUrl:
    def test_url_uses_wss_for_https_base(self, opper: Opper) -> None:
        assert opper.realtime.url() == "wss://api.opper.ai/v3/realtime"

    def test_url_uses_ws_for_http_base(self, monkeypatch) -> None:
        monkeypatch.setenv("OPPER_API_KEY", "k")
        monkeypatch.setenv("OPPER_BASE_URL", "http://localhost:8000")
        o = Opper()
        assert o.realtime.url() == "ws://localhost:8000/v3/realtime"

    def test_url_appends_ticket(self, opper: Opper) -> None:
        assert opper.realtime.url(ticket="abc-def") == "wss://api.opper.ai/v3/realtime?ticket=abc-def"

    def test_url_encodes_ticket(self, opper: Opper) -> None:
        assert (
            opper.realtime.url(ticket="a b/c=d")
            == "wss://api.opper.ai/v3/realtime?ticket=a%20b%2Fc%3Dd"
        )


class TestRealtimeCreateSession:
    def test_posts_to_realtime_sessions(self, opper: Opper) -> None:
        opper._client._post.return_value = {
            "client_secret": "secret-123",
            "expires_at": "2026-01-01T00:00:00Z",
        }
        session = opper.realtime.create_session(
            config={"model": "openai/gpt-realtime-2", "voice": "marin"},
            ttl_seconds=60,
        )
        assert isinstance(session, RealtimeSession)
        assert session.client_secret == "secret-123"
        assert session.expires_at == "2026-01-01T00:00:00Z"

        call = opper._client._post.call_args
        assert call.args[0] == "/v3/realtime-sessions"
        body = call.args[1]
        assert body["config"]["model"] == "openai/gpt-realtime-2"
        assert body["ttl_seconds"] == 60

    def test_forwards_locked_fields(self, opper: Opper) -> None:
        opper._client._post.return_value = {"client_secret": "s", "expires_at": "t"}
        opper.realtime.create_session(
            config={"model": "openai/gpt-realtime-2"},
            locked_fields=["output_transcription"],
        )
        body = opper._client._post.call_args.args[1]
        assert body["locked_fields"] == ["output_transcription"]

    async def test_create_session_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"client_secret": "x", "expires_at": "y"}
        session = await opper.realtime.create_session_async(config={"model": "openai/gpt-realtime-2"})
        assert session.client_secret == "x"
