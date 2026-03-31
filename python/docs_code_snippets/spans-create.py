from datetime import datetime, timezone
from opperai import Opper

opper = Opper()

# --- docs ---
span = opper.spans.create(
    name="my-pipeline",
    start_time=datetime.now(timezone.utc).isoformat(),
    input="Starting the pipeline",
    meta={"userId": "u-123"},
)
print(f"Span: {span.id}, Trace: {span.trace_id}")
# --- /docs ---

# Cleanup
opper.spans.delete(span.id)
