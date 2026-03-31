import time
from opperai import Opper

opper = Opper()

fn_name = f"docs-snippet-{int(time.time())}"

# --- docs ---
# Functions are auto-created on first call
result = opper.call(
    fn_name,
    input={"text": "Hello world"},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
)
print(result.data)
# --- /docs ---

# Cleanup
opper.functions.delete(fn_name)
