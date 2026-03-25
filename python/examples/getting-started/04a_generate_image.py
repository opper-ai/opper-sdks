# Image generation via the image_gen builtin
import base64
from pathlib import Path

from opperai import Opper

opper = Opper()
media_dir = Path(__file__).parent / "media"

# ── Option 1: Convenience method with .save() ──────────────────────────────

easy = opper.generate_image(
    "sdk-test-generate-image",
    prompt="A sunset over a calm ocean with two sailboats",
)

print("── Convenience method ──")
print("MIME type:", easy.data.get("mime_type"))
print("Meta:", easy.meta)

# Save to file — extension auto-appended from mime_type
saved_path = easy.save(str(media_dir / "generated-image"))
print(f"Saved to {saved_path}")

# ── Option 2: Raw call() with explicit schemas ─────────────────────────────

raw = opper.call(
    "sdk-test-generate-image-raw",
    input={"description": "A sunset over a calm ocean with two sailboats"},
    input_schema={
        "type": "object",
        "properties": {"description": {"type": "string", "description": "Text description of the image"}},
    },
    output_schema={
        "type": "object",
        "properties": {
            "image": {"type": "string", "description": "Base64-encoded image data"},
            "mime_type": {"type": "string", "description": "MIME type of the generated image"},
        },
    },
)

print("\n── Raw call() ──")
print("MIME type:", raw.data.get("mime_type"))
image_b64 = raw.data.get("image", "")
print("Image base64 length:", len(image_b64))

ext = (raw.data.get("mime_type", "image/png")).split("/")[-1]
raw_path = media_dir / f"generated-image-raw.{ext}"
raw_path.write_bytes(base64.b64decode(image_b64))
print(f"Saved to {raw_path}")
