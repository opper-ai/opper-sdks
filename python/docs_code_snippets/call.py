from pydantic import BaseModel
from opperai import Opper

opper = Opper()


class CapitalOutput(BaseModel):
    capital: str
    population: int | None = None


# --- docs ---
result = opper.call(
    "get_capital",
    instructions="Return the capital of the given country.",
    input={"country": "Sweden"},
    output_schema=CapitalOutput,
)

print(result.data.capital)
# --- /docs ---
