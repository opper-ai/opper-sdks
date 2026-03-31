from opperai import Opper

opper = Opper()

# --- docs ---
result = opper.call(
    "agent-round",
    instructions="Use the available tools to help the user",
    input={
        "message": "What is the weather in Stockholm?",
        "tools": [
            {
                "name": "get_weather",
                "description": "Get current weather for a location",
                "parameters": {
                    "type": "object",
                    "properties": {"location": {"type": "string"}},
                    "required": ["location"],
                },
            }
        ],
    },
    output_schema={
        "type": "object",
        "properties": {
            "message": {"type": "string"},
            "tool_call": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "arguments": {"type": "object"},
                },
            },
        },
    },
)

print(result.data)
# --- /docs ---
