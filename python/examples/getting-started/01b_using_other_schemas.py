# Comparing schema approaches: Pydantic, dataclass, raw dict
from dataclasses import dataclass

from pydantic import BaseModel

from opperai import Opper

opper = Opper()

TEXT = "Marie Curie conducted groundbreaking research on radioactivity in Paris."


# ── Option 1: Pydantic (recommended) ────────────────────────────────────────


class TextInput(BaseModel):
    text: str


class EntitiesPydantic(BaseModel):
    people: list[str]
    locations: list[str]


result1 = opper.call(
    "sdk-test-extract-pydantic",
    input=TextInput(text=TEXT),
    input_schema=TextInput,
    output_schema=EntitiesPydantic,
    model="vertexai/gemini-2.5-flash",
)
print("── Pydantic (input + output schema) ──")
print("People:", result1.data.people)  # typed!
print("Locations:", result1.data.locations)


# ── Option 2: Dataclass ─────────────────────────────────────────────────────


@dataclass
class TextInputDC:
    text: str


@dataclass
class EntitiesDataclass:
    people: list[str]
    locations: list[str]


result2 = opper.call(
    "sdk-test-extract-dataclass",
    input={"text": TEXT},
    input_schema=TextInputDC,
    output_schema=EntitiesDataclass,
    model="vertexai/gemini-2.5-flash",
)
print("\n── Dataclass (input + output schema) ──")
print("People:", result2.data.people)
print("Locations:", result2.data.locations)


# ── Option 3: Raw JSON Schema ───────────────────────────────────────────────

result3 = opper.call(
    "sdk-test-extract-raw",
    input={"text": TEXT},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
    output_schema={
        "type": "object",
        "properties": {
            "people": {"type": "array", "items": {"type": "string"}},
            "locations": {"type": "array", "items": {"type": "string"}},
        },
    },
    model="vertexai/gemini-2.5-flash",
)
print("\n── Raw JSON Schema (input + output schema) ──")
print("People:", result3.data["people"])
print("Locations:", result3.data["locations"])


# ── Option 4: No schema (untyped) ───────────────────────────────────────────

result4 = opper.call(
    "sdk-test-extract-untyped",
    input=TEXT,
    model="anthropic/claude-sonnet-4.6",
)
print("\n── Untyped ──")
print("Data:", result4.data)
