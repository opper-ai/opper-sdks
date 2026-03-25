# Embeddings: generate vector embeddings for semantic similarity
import math

from opperai import Opper

opper = Opper()


# ── Single text embedding ───────────────────────────────────────────────────

result = opper.call(
    "sdk-test-embed",
    input={"text": "The quick brown fox jumps over the lazy dog"},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={
        "type": "object",
        "properties": {"embedding": {"type": "array", "items": {"type": "number"}}},
    },
    model="openai/text-embedding-3-small",
)

print("── Single embedding ──")
print("Dimensions:", len(result.data["embedding"]))
print("First 5 values:", result.data["embedding"][:5])


# ── Compare similarity between two texts ────────────────────────────────────


def embed(text: str) -> list[float]:
    r = opper.call(
        "sdk-test-embed",
        input={"text": text},
        input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"embedding": {"type": "array", "items": {"type": "number"}}}},
        model="openai/text-embedding-3-small",
    )
    return r.data["embedding"]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    return dot / (mag_a * mag_b)


vec_a = embed("I love programming in Python")
vec_b = embed("Python is my favorite language for coding")
vec_c = embed("The weather in Stockholm is cold today")

print("\n── Similarity comparison ──")
print(f"Similar texts: {cosine_similarity(vec_a, vec_b):.4f}")
print(f"Unrelated texts: {cosine_similarity(vec_a, vec_c):.4f}")
