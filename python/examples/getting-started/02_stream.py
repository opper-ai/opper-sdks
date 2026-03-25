# Streaming function execution
import sys
from opperai import Opper

opper = Opper()

print("── Streaming deltas ──")

for chunk in opper.stream(
    "sdk-test-explain",
    input={"topic": "How do SSE streams work?"},
    output_schema={
        "type": "object",
        "properties": {"explanation": {"type": "string"}},
    },
    model="anthropic/claude-sonnet-4.6",
):
    match chunk.type:
        case "content":
            sys.stdout.write(chunk.delta)
            sys.stdout.flush()
        case "done":
            print()
            print("Usage:", chunk.usage)
        case "complete":
            print("\n── Accumulated output (from complete event) ──")
            print("Output:", chunk.data)
            print("Meta:", chunk.meta)
        case "error":
            print("Stream error:", chunk.error, file=sys.stderr)
