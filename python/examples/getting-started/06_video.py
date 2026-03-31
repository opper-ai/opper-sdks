# Video generation via the video_gen builtin.
# Videos are generated asynchronously — the convenience method handles
# polling and downloading automatically. The schema-driven call() shows
# the raw pending operations flow.
import time
import urllib.request
from pathlib import Path

from opperai import Opper

media_dir = Path(__file__).parent / "media"
opper = Opper()

# ── Option 1: Schema-driven call() (manual pending handling) ────────────────

print("Generating video (schema-driven)...")
raw = opper.call(
    "sdk-test-generate-video-raw",
    input={
        "prompt": "A calm ocean wave rolling onto a sandy beach at sunset, cinematic",
    },
    input_schema={
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Text description of the video to generate",
            }
        },
    },
    output_schema={
        "type": "object",
        "properties": {
            "video": {"type": "string", "description": "Base64-encoded video data"},
            "mime_type": {
                "type": "string",
                "description": "MIME type of the generated video",
            },
        },
    },
    model="openai/sora-2",
)

print("Meta:", raw.meta)

# Handle async pending response
if isinstance(raw.meta, dict) and raw.meta.get("status") == "pending":
    for op in raw.meta.get("pending_operations", []):
        print(f"Polling artifact {op['id']}...")
        while True:
            status = opper.artifacts.get_status(op["id"])
            print(f"  status: {status.status}")
            if status.status == "completed":
                out_path = media_dir / "generated-video-raw.mp4"
                urllib.request.urlretrieve(status.url, str(out_path))
                print(f"Saved to {out_path}")
                break
            if status.status == "failed":
                print(f"  error: {status.error}")
                break
            time.sleep(5)
else:
    import base64

    video_data = raw.data.get("video", "")
    ext = (raw.data.get("mime_type", "video/mp4")).split("/")[-1]
    out_path = media_dir / f"generated-video-raw.{ext}"
    out_path.write_bytes(base64.b64decode(video_data))
    print(f"Saved to {out_path}")

# ── Option 2: Convenience method (polls + downloads automatically) ──────────

print("\nGenerating video (convenience) — polls automatically...")
result = opper.generate_video(
    "sdk-test-generate-video",
    prompt="A cat and a dog in a park",
    model="openai/sora-2",
)

print("Meta:", result.meta)
saved_path = result.save(str(media_dir / "generated-video-convenience"))
print(f"Saved to {saved_path}")
