from datetime import datetime, timezone
from opperai import Opper

opper = Opper()

# Setup
span = opper.spans.create(
    name="my-pipeline",
    start_time=datetime.now(timezone.utc).isoformat(),
)

# --- docs ---
opper.spans.update(
    span.id,
    output="Pipeline completed successfully",
    end_time=datetime.now(timezone.utc).isoformat(),
    meta={"total_calls": 3},
)
# --- /docs ---

# Cleanup
opper.spans.delete(span.id)
