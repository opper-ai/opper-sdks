"""Opper SDK — Realtime Client (`/v3/realtime` WebSocket endpoint)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .._base_client import BaseClient
from ..types import RealtimeSession, RequestOptions, _from_dict


class RealtimeClient:
    """Client for the model-driven realtime WebSocket endpoint.

    Two usage patterns:

      1. **Server-side**: connect directly to :meth:`url` with a Bearer
         ``Authorization`` header (your project API key). Send a
         ``session.start`` event with ``config.model`` and the rest inline.

      2. **Browser-direct**: mint a single-use ticket via :meth:`create_session`
         on your backend, return only the ``client_secret`` to the browser.
         The browser opens
         ``new WebSocket(url, ["opper-ticket.<secret>"])`` — browsers cannot
         set ``Authorization`` on a WebSocket constructor, so the ticket rides
         in the ``Sec-WebSocket-Protocol`` subprotocol header. Fields populated
         in ``config`` are bound to the ticket and cannot be overridden by the
         browser at ``session.start``.
    """

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def url(self, *, ticket: str | None = None) -> str:
        """Build the WebSocket URL for ``/v3/realtime``.

        :param ticket: Optional ticket secret. If passed, appended as
            ``?ticket=<secret>``. Prefer the subprotocol header form in
            browsers; pass ``ticket`` here only for clients that can't set
            subprotocols.
        """
        base = self._client._base_url
        scheme = "wss" if base.startswith("https") else "ws"
        host = base.replace("https://", "").replace("http://", "")
        path = f"{scheme}://{host}/v3/realtime"
        if ticket:
            path = f"{path}?ticket={quote(ticket, safe='')}"
        return path

    def create_session(
        self,
        *,
        config: dict[str, Any] | None = None,
        locked_fields: list[str] | None = None,
        ttl_seconds: int | None = None,
        options: RequestOptions | None = None,
    ) -> RealtimeSession:
        """Mint a single-use ephemeral ticket for browser-direct WebSocket access.

        POST ``/v3/realtime-sessions``

        The returned ``client_secret`` is what the browser passes via the
        ``opper-ticket.<secret>`` subprotocol when opening the WebSocket.

        :param config: Fields locked to the ticket — at minimum set ``model``.
            Common fields: ``model``, ``voice``, ``instructions``, ``tools``,
            ``modalities``, ``input_transcription``, ``output_transcription``,
            ``turn_detection``, ``reasoning_effort``, ``temperature``.
        :param locked_fields: Field names whose zero value must stay zero
            (e.g. force ``output_transcription`` off). Fields not listed
            remain open for the browser to fill in.
        :param ttl_seconds: Ticket lifetime in seconds.
        """
        body: dict[str, Any] = {}
        if config is not None:
            body["config"] = config
        if locked_fields is not None:
            body["locked_fields"] = locked_fields
        if ttl_seconds is not None:
            body["ttl_seconds"] = ttl_seconds
        data = self._client._post("/v3/realtime-sessions", body, options=options)
        return _from_dict(RealtimeSession, data)

    async def create_session_async(
        self,
        *,
        config: dict[str, Any] | None = None,
        locked_fields: list[str] | None = None,
        ttl_seconds: int | None = None,
        options: RequestOptions | None = None,
    ) -> RealtimeSession:
        """Async variant of :meth:`create_session`."""
        body: dict[str, Any] = {}
        if config is not None:
            body["config"] = config
        if locked_fields is not None:
            body["locked_fields"] = locked_fields
        if ttl_seconds is not None:
            body["ttl_seconds"] = ttl_seconds
        data = await self._client._post_async("/v3/realtime-sessions", body, options=options)
        return _from_dict(RealtimeSession, data)
