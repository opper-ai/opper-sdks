import time
from opperai import Opper

opper = Opper()

# Setup: create function via call
fn_name = f"docs-snippet-{int(time.time())}"
opper.call(fn_name, input="hello", output_schema={"type": "object", "properties": {"reply": {"type": "string"}}})

# --- docs ---
revisions = opper.functions.list_revisions(fn_name)
for rev in revisions:
    print(f"Revision {rev.revision_id} (current: {rev.is_current}, created: {rev.created_at})")
# --- /docs ---

# Cleanup
opper.functions.delete(fn_name)
