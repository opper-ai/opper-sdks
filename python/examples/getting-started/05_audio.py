# Audio: text-to-speech and speech-to-text in one flow
import base64
from pathlib import Path

from opperai import Opper

opper = Opper()
media_dir = Path(__file__).parent / "media"

# ── Convenience methods ─────────────────────────────────────────────────────

tts_result = opper.text_to_speech(
    "sdk-test-tts",
    text="Hello! This is a test of the Opper text-to-speech API. Pretty cool, right?",
)

print("── TTS (convenience) ──")
audio_data = tts_result.data
audio_b64 = audio_data.get("audio", "") if isinstance(audio_data, dict) else ""
print("Audio base64 length:", len(audio_b64))

tts_path = media_dir / "generated-speech.mp3"
tts_path.write_bytes(base64.b64decode(audio_b64))
print(f"Saved to {tts_path}")

stt_result = opper.transcribe("sdk-test-stt", audio=base64.b64decode(audio_b64))

print("\n── STT (convenience) ──")
print("Transcription:", stt_result.data)

# ── Raw call() with explicit schemas ────────────────────────────────────────

raw_tts = opper.call(
    "sdk-test-tts-raw",
    input={"text": "Hello! This is a test of the Opper text-to-speech API. Pretty cool, right?"},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={"type": "object", "properties": {"audio": {"type": "string"}}},
)

print("\n── TTS (raw call) ──")
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

print("\n── STT (raw call) ──")
print("Transcription:", raw_stt.data.get("text"))
print("Language:", raw_stt.data.get("language"))
