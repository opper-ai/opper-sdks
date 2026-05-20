"""Realtime — mint an ephemeral ticket for a browser-direct voice session.

The `/v3/realtime` endpoint is a WebSocket. Two usage patterns exist; this
example shows the recommended browser-direct pattern where your Python
backend mints a single-use ticket and the browser opens the WebSocket
directly to Opper:

  Server  -- POST /v3/realtime-sessions  -->  Opper
          <-- { client_secret, expires_at } --
  Browser -- WebSocket(opper.realtime.url(),
              ["opper-ticket.<client_secret>"]) --> Opper

The API key never leaves your server. Fields populated in `config` are
bound to the ticket and cannot be overridden by the browser at
`session.start`, so a leaked ticket can only open the session the issuer
authorized.

For a full end-to-end example (server + browser audio I/O), see the
cookbook `brainstorm-time` example. This script just demonstrates the
SDK API surface.
"""

from __future__ import annotations

from opperai import Opper

opper = Opper()

print("Minting a realtime ticket...\n")

ticket = opper.realtime.create_session(
    config={
        "model": "openai/gpt-realtime-2",
        "voice": "marin",
        "instructions": "You are a friendly assistant. Keep answers short.",
        "input_transcription": True,
        "output_transcription": True,
        "turn_detection": {
            "type": "server_vad",
            "threshold": 0.5,
            "silence_duration_ms": 500,
        },
    },
    # locked_fields=["output_transcription"],  # force a zero value to stay zero
    ttl_seconds=60,
)

print(f"  client_secret: {ticket.client_secret[:8]}…")
print(f"  expires_at:    {ticket.expires_at}")
print()
print("Hand only the client_secret to the browser. It opens:")
print(f'  new WebSocket("{opper.realtime.url()}", ["opper-ticket.<client_secret>"])')
print()
print("On open, the browser sends `{ type: \"session.start\", config: {} }` —")
print("config is empty because all the fields were bound at mint time.")
