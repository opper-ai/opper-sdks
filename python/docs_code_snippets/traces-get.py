import time
from datetime import datetime, timezone
from opperai import Opper

opper = Opper()

# Setup: create a span (which creates a trace)
span = opper.spans.create(
    name="my-pipeline",
    start_time=datetime.now(timezone.utc).isoformat(),
)
time.sleep(1)  # wait for trace to be indexed
# /setup

# --- docs ---
trace = opper.traces.get(span.trace_id)
print(f"Name: {trace.name}, Spans: {trace.span_count}")
for s in trace.spans:
    indent = "  " if not s.parent_id else "    "
    print(f"{indent}{s.name} ({s.id[:8]}...)")
# --- /docs ---

# Cleanup
opper.traces.delete(span.trace_id)
