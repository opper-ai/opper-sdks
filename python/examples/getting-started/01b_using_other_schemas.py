# Comparing schema approaches: Pydantic, dataclass, raw dict
from dataclasses import dataclass
from pydantic import BaseModel
from opperai import Opper

opper = Opper()

TEXT = "Marie Curie conducted groundbreaking research on radioactivity in Paris."


# ── Option 1: Pydantic (recommended) ────────────────────────────────────────


class EntitiesPydantic(BaseModel):
    people: list[str]
    locations: list[str]


result1 = opper.call(
    "sdk-test-extract-pydantic",
    input={"text": TEXT},
    output_schema=EntitiesPydantic,
    model="anthropic/claude-sonnet-4.6",
)
print("── Pydantic ──")
print("People:", result1.data.people)  # typed!
print("Locations:", result1.data.locations)


# ── Option 2: Dataclass ─────────────────────────────────────────────────────


@dataclass
class EntitiesDataclass:
    people: list[str]
    locations: list[str]


result2 = opper.call(
    "sdk-test-extract-dataclass",
    input={"text": TEXT},
    output_schema=EntitiesDataclass,
    model="anthropic/claude-sonnet-4.6",
)
print("\n── Dataclass ──")
print("People:", result2.data.people)
print("Locations:", result2.data.locations)


# ── Option 3: Raw JSON Schema ───────────────────────────────────────────────

result3 = opper.call(
    "sdk-test-extract-raw",
    input={"text": TEXT},
    output_schema={
        "type": "object",
        "properties": {
            "people": {"type": "array", "items": {"type": "string"}},
            "locations": {"type": "array", "items": {"type": "string"}},
        },
    },
    model="anthropic/claude-sonnet-4.6",
)
print("\n── Raw JSON Schema ──")
print("People:", result3.data["people"])
print("Locations:", result3.data["locations"])


# ── Option 4: No schema (untyped) ───────────────────────────────────────────

result4 = opper.call(
    "sdk-test-extract-untyped",
    input={"text": TEXT},
    model="anthropic/claude-sonnet-4.6",
)
print("\n── Untyped ──")
print("Data:", result4.data)
