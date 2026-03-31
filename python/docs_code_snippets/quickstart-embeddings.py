from opperai import Opper

opper = Opper()

# --- docs ---
result = opper.call(
    "embed-text",
    instructions="Generate an embedding vector for the input text",
    input={"text": "The benefits of using an AI gateway"},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={
        "type": "object",
        "properties": {"embedding": {"type": "array", "items": {"type": "number"}}},
    },
    model="openai/text-embedding-3-small",
)

print(f"Dimensions: {len(result.data['embedding'])}")
print(f"First 5: {result.data['embedding'][:5]}")
# --- /docs ---
