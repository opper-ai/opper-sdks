from opperai import Opper

opper = Opper()

# --- docs ---
result = opper.call(
    "weather-check",
    instructions="Use the available tools to help the user",
    input="What is the weather in Stockholm?",
    output_schema={
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
        },
    },
    tools=[
        {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        }
    ],
)

print("Answer:", result.data)
# --- /docs ---
