# Tools: non-streaming call with tool definitions
# Schemas can be Pydantic models, raw dicts, or Python types — mix and match freely.
from pydantic import BaseModel, Field

from opperai import Opper

opper = Opper()


# ── Pydantic for structured schemas (optional — raw dicts work too) ─────────


class AssistantResponse(BaseModel):
    answer: str | None = Field(default=None, description="The assistant's text response")
    tool_calls: list[dict] | None = Field(default=None, description="Tool calls requested by the model")


class WeatherParams(BaseModel):
    city: str = Field(description="City name")
    unit: str | None = Field(default=None, description="Temperature unit: celsius or fahrenheit")


# ── Call with tools ─────────────────────────────────────────────────────────

result = opper.call(
    "sdk-test-tool-use",
    input={"question": "What is the current weather in Stockholm?"},  # plain dict
    input_schema={"type": "object", "properties": {"question": {"type": "string"}}},  # raw JSON Schema
    output_schema=AssistantResponse,  # Pydantic model
    model="anthropic/claude-sonnet-4.6",
    tools=[
        {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": WeatherParams,  # Pydantic model for tool params
        },
    ],
)

# When output_schema is a Pydantic model, result.data is typed
print("Answer:", result.data.answer)
print("Tool calls:", result.data.tool_calls)
