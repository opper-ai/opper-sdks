import sys
import time
from opperai import Opper

opper = Opper()

fn_name = f"docs-snippet-{int(time.time())}"

# --- docs ---
for chunk in opper.stream(
    fn_name,
    input={"text": "Explain streaming"},
    output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
):
    if chunk.type == "content":
        sys.stdout.write(chunk.delta)
        sys.stdout.flush()
    elif chunk.type == "done":
        print()
# --- /docs ---

# Cleanup
opper.functions.delete(fn_name)
