from pydantic import BaseModel
from opperai import Opper

opper = Opper()


class ImageOutput(BaseModel):
    image: str  # base64-encoded PNG


# --- docs ---
result = opper.call(
    "generate-image",
    instructions="Generate an image based on the description",
    input={"description": "A serene mountain landscape at sunset"},
    output_schema=ImageOutput,
)

print(f"Generated image ({len(result.data.image)} base64 chars)")
# --- /docs ---
