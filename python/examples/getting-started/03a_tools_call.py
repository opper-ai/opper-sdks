# Tools: non-streaming call with tool definitions
from opperai import Opper

opper = Opper()

result = opper.call(
    "sdk-test-tool-use",
    input={"question": "What is the current weather in Stockholm?"},
    input_schema={
        "type": "object",
        "properties": {"question": {"type": "string", "description": "The user's question"}},
        "required": ["question"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "answer": {"type": "string", "description": "The assistant's text response"},
            "tool_calls": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "arguments": {"type": "object"},
                    },
                },
                "description": "Tool calls requested by the model",
            },
        },
    },
    model="anthropic/claude-sonnet-4.6",
    tools=[
        {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit",
                    },
                },
                "required": ["city"],
            },
        },
    ],
)

print("Answer:", result.data.get("answer"))
print("Tool calls:", result.data.get("tool_calls"))
