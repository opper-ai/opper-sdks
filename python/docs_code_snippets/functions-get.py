import time
from opperai import Opper

opper = Opper()

# Setup: create function via call
fn_name = f"docs-snippet-{int(time.time())}"
opper.call(fn_name, input="hello", output_schema={"type": "object", "properties": {"reply": {"type": "string"}}})

# --- docs ---
fn = opper.functions.get(fn_name)
print(f"Name: {fn.name}")
print(f"Schema hash: {fn.schema_hash}")
print(f"Hit count: {fn.hit_count}")
# --- /docs ---

# Cleanup
opper.functions.delete(fn_name)
