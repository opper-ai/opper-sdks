# Image generation via the image_gen builtin
from pathlib import Path
from opperai import Opper

opper = Opper()
media_dir = Path(__file__).parent / "media"

# ── Option 1: Convenience method ────────────────────────────────────────────

easy = opper.generate_image(
    "sdk-test-generate-image",
    prompt="A sunset over a calm ocean with two sailboats",
)

print("── Convenience method ──")
print("Image data keys:", list(easy.data.keys()) if isinstance(easy.data, dict) else type(easy.data))
print("Meta:", easy.meta)

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

import base64

ext = (raw.data.get("mime_type", "image/png")).split("/")[-1]
raw_path = media_dir / f"generated-image-raw.{ext}"
raw_path.write_bytes(base64.b64decode(image_b64))
print(f"Saved to {raw_path}")
