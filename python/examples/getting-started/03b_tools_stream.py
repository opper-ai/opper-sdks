# Tools: streaming with tool_call chunks
# Shows raw dict schemas — no Pydantic needed. See 03a for Pydantic approach.
import sys

from opperai import Opper

opper = Opper()

print("Streaming with tools:")

for chunk in opper.stream(
    "sdk-test-tool-use-stream",
    input={"question": "What is the current weather in Stockholm?"},
    input_schema={"type": "object", "properties": {"question": {"type": "string"}}},
    output_schema={
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "tool_calls": {"type": "array", "items": {"type": "object"}},
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
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["city"],
            },
        },
    ],
):
    match chunk.type:
        case "tool_call_start":
            print(f"\n[tool_call_start] name={chunk.tool_call_name} id={chunk.tool_call_id}")
        case "tool_call_delta":
            sys.stdout.write(chunk.tool_call_args)
            sys.stdout.flush()
        case "content":
            sys.stdout.write(chunk.delta)
            sys.stdout.flush()
        case "done":
            print(f"\n[done] {chunk.usage}")
        case "complete":
            print(f"[complete] data: {chunk.data}")
        case "error":
            print(f"[error] {chunk.error}", file=sys.stderr)
