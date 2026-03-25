# Image description (vision) — send a base64 image and get a structured description.
# The platform routes to llm() with multimodal content when the input includes an image.
import base64
from pathlib import Path
from opperai import Opper

media_dir = Path(__file__).parent / "media"
image_b64 = base64.b64encode((media_dir / "image.png").read_bytes()).decode()

opper = Opper()

result = opper.call(
    "sdk-test-describe-image",
    input={
        "image": image_b64,
        # You can also pass a URL instead of base64:
        # "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg",
    },
    input_schema={
        "type": "object",
        "properties": {"image": {"type": "string", "description": "Base64-encoded image to describe"}},
    },
    output_schema={
        "type": "object",
        "properties": {"description": {"type": "string", "description": "Detailed description of the image"}},
    },
)

print("Description:", result.data.get("description"))
