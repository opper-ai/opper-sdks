# Image editing — pass a reference image to generate_image() to transform it.
# The platform routes to image_gen() with the reference image included.
import base64
from pathlib import Path

from opperai import Opper

media_dir = Path(__file__).parent / "media"
opper = Opper()

# ── Option 1: Convenience method ────────────────────────────────────────────
# Accepts a file path directly — the SDK reads and base64-encodes it for you.

easy = opper.generate_image(
    "sdk-test-edit-image",
    prompt="Give the cat some sunglasses and a party hat",
    reference_image=str(media_dir / "image.png"),
)

print("── Convenience method ──")
print("Image data keys:", list(easy.data.keys()) if isinstance(easy.data, dict) else type(easy.data))
print("Meta:", easy.meta)

# ── Option 2: Raw call() with explicit schemas ─────────────────────────────

image_b64 = base64.b64encode((media_dir / "image.png").read_bytes()).decode()

raw = opper.call(
    "sdk-test-edit-image-raw",
    input={
        "description": "Give the cat some sunglasses and a party hat",
        "reference_image": image_b64,
    },
    input_schema={
        "type": "object",
        "properties": {
            "description": {"type": "string", "description": "Text description of the image to generate"},
            "reference_image": {"type": "string", "description": "Base64-encoded reference image"},
        },
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
image_data = raw.data.get("image", "")
print("Image base64 length:", len(image_data))

ext = (raw.data.get("mime_type", "image/png")).split("/")[-1]
raw_path = media_dir / f"edited-image-raw.{ext}"
raw_path.write_bytes(base64.b64decode(image_data))
print(f"Saved to {raw_path}")
