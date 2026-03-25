# Video generation via the video_gen builtin.
# The platform routes to video_gen() when the schemas indicate video output.
import base64
from pathlib import Path
from opperai import Opper

media_dir = Path(__file__).parent / "media"
opper = Opper()

# ── Option 1: Convenience method ────────────────────────────────────────────

print("Generating video (convenience) — this can take up to a couple of minutes...")
easy = opper.generate_video(
    "sdk-test-generate-video",
    prompt="A calm ocean wave rolling onto a sandy beach at sunset, cinematic",
)

print("── Convenience method ──")
print("Video data keys:", list(easy.data.keys()) if isinstance(easy.data, dict) else type(easy.data))
print("Meta:", easy.meta)

# Advanced options (uncomment to try):
# advanced = opper.generate_video(
#     "sdk-test-generate-video-advanced",
#     prompt="A cat wearing sunglasses walking down a city street",
#     model="openai/sora-2",
#     aspect_ratio="16:9",
# )

# ── Option 2: Raw call() with explicit schemas ─────────────────────────────

print("\nGenerating video (raw call) — this can take up to a couple of minutes...")
raw = opper.call(
    "sdk-test-generate-video-raw",
    input={
        "prompt": "A calm ocean wave rolling onto a sandy beach at sunset, cinematic",
    },
    input_schema={
        "type": "object",
        "properties": {"prompt": {"type": "string", "description": "Text description of the video to generate"}},
    },
    output_schema={
        "type": "object",
        "properties": {
            "video": {"type": "string", "description": "Base64-encoded video data"},
            "mime_type": {"type": "string", "description": "MIME type of the generated video"},
        },
    },
)

print("\n── Raw call() ──")
print("MIME type:", raw.data.get("mime_type"))
video_data = raw.data.get("video", "")
print("Video base64 length:", len(video_data))

ext = (raw.data.get("mime_type", "video/mp4")).split("/")[-1]
raw_path = media_dir / f"generated-video-raw.{ext}"
raw_path.write_bytes(base64.b64decode(video_data))
print(f"Saved to {raw_path}")
