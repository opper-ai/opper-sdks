import time
from opperai import Opper

opper = Opper()

# Setup: create function via call
fn_name = f"docs-snippet-{int(time.time())}"
opper.call(fn_name, input="hello", output_schema={"type": "object", "properties": {"reply": {"type": "string"}}})

# --- docs ---
fn = opper.functions.get(fn_name)
# Update is done by calling with new schemas - the function auto-updates
result = opper.call(
    fn_name,
    input={"text": "Updated input"},
    output_schema={"type": "object", "properties": {"result": {"type": "string"}}},
)
print(result.data)
# --- /docs ---

# Cleanup
opper.functions.delete(fn_name)
