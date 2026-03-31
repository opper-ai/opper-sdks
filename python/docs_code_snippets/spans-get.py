from datetime import datetime, timezone
from opperai import Opper

opper = Opper()

# Setup
setup_span = opper.spans.create(
    name="my-pipeline",
    start_time=datetime.now(timezone.utc).isoformat(),
)

# --- docs ---
span = opper.spans.get(setup_span.id)
print(f"Name: {span.name}, Trace: {span.trace_id}")
# --- /docs ---

# Cleanup
opper.spans.delete(setup_span.id)
