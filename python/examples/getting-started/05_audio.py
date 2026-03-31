# Audio: text-to-speech and speech-to-text in one flow
import base64
from pathlib import Path

from opperai import Opper

opper = Opper()
media_dir = Path(__file__).parent / "media"

# ── Option 1: Schema-driven call() ────────────────────────────────────────

raw_tts = opper.call(
    "sdk-test-tts-raw",
    input={"text": "Hello! This is a test of the Opper text-to-speech API. Pretty cool, right?"},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={"type": "object", "properties": {"audio": {"type": "string"}}},
)

print("── TTS (schema-driven) ──")
raw_audio_b64 = raw_tts.data.get("audio", "")
print("Audio base64 length:", len(raw_audio_b64))

raw_tts_path = media_dir / "generated-speech-raw.mp3"
raw_tts_path.write_bytes(base64.b64decode(raw_audio_b64))
print(f"Saved to {raw_tts_path}")

raw_stt = opper.call(
    "sdk-test-stt-raw",
    input={"audio": raw_audio_b64},
    input_schema={"type": "object", "properties": {"audio": {"type": "string"}}},
    output_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "language": {"type": "string"},
        },
    },
)

print("\n── STT (schema-driven) ──")
print("Transcription:", raw_stt.data.get("text"))
print("Language:", raw_stt.data.get("language"))

# ── Option 2: Convenience methods ─────────────────────────────────────────

tts_result = opper.text_to_speech(
    "sdk-test-tts",
    text="Hello! This is a test of the Opper text-to-speech API. Pretty cool, right?",
)

print("\n── TTS (convenience) ──")
audio_b64 = tts_result.data.get("audio", "") if isinstance(tts_result.data, dict) else ""
print("Audio base64 length:", len(audio_b64))

# Save with .save() — extension auto-appended
tts_path = tts_result.save(str(media_dir / "generated-speech"))
print(f"Saved to {tts_path}")

stt_result = opper.transcribe("sdk-test-stt", audio=base64.b64decode(audio_b64))

print("\n── STT (convenience) ──")
print("Transcription:", stt_result.data)
