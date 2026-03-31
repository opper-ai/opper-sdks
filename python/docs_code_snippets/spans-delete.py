from datetime import datetime, timezone
from opperai import Opper

opper = Opper()

# Setup
span = opper.spans.create(
    name="my-pipeline",
    start_time=datetime.now(timezone.utc).isoformat(),
)

# --- docs ---
opper.spans.delete(span.id)
# --- /docs ---
