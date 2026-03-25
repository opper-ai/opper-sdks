# Using schemas — recommended approach with Pydantic
from pydantic import BaseModel

from opperai import Opper


class Person(BaseModel):
    name: str
    role: str | None = None


class Entities(BaseModel):
    people: list[Person]
    locations: list[str]


opper = Opper()

result = opper.call(
    "sdk-test-extract-entities",
    input={
        "text": "Marie Curie conducted groundbreaking research on radioactivity in Paris. "
        "She was the first woman to win a Nobel Prize. Her husband was Pierre Curie.",
    },
    output_schema=Entities,
    model="anthropic/claude-sonnet-4.6",
)

print("Full result:", result)
print("People:", [person.name for person in result.data.people])  # typed!
print("Locations:", result.data.locations)  # typed!
