from opperai import Opper

opper = Opper()

# --- docs ---
result = opper.call(
    "embed-text",
    input={"text": "The quick brown fox jumps over the lazy dog"},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={
        "type": "object",
        "properties": {"embedding": {"type": "array", "items": {"type": "number"}}},
    },
    model="openai/text-embedding-3-small",
)

print(f"Dimensions: {len(result.data['embedding'])}")
# --- /docs ---
