from opperai import Opper

opper = Opper()

# Setup: generate audio via TTS
tts = opper.text_to_speech("docs-tts", text="Hello, this is a test.")
audio_b64 = tts.data["audio"]

# --- docs ---
result = opper.call(
    "audio-summarize",
    instructions="Listen to the audio and provide a text summary and an audio narration of the summary",
    input={"audio": audio_b64},
    input_schema={
        "type": "object",
        "properties": {
            "audio": {"type": "string", "contentMediaType": "audio/wav", "contentEncoding": "base64"}
        },
    },
    output_schema={
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "audio_summary": {"type": "string", "contentMediaType": "audio/wav", "contentEncoding": "base64"},
        },
    },
)

print("Summary:", result.data["summary"])
# --- /docs ---
