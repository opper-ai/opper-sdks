# Manual tracing: create spans directly and wire parent_span_id by hand
import json
from datetime import datetime, timezone
from opperai import Opper

opper = Opper()

# ── Create a root span ──────────────────────────────────────────────────────

root_span = opper.spans.create(
    name="my-pipeline",
    start_time=datetime.now(timezone.utc).isoformat(),
    input="Starting the pipeline",
    meta={"userId": "u-123", "environment": "example"},
    tags={"team": "sdk"},
)

print("── Root span created ──")
print("Span ID:", root_span.id)
print("Trace ID:", root_span.trace_id)

# ── Call a function under this span ─────────────────────────────────────────

result = opper.call(
    "sdk-test-summarize",
    input={"text": "Manual tracing lets you control exactly how spans are organized."},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
    parent_span_id=root_span.id,
)

print("\n── Function call (attached to root span) ──")
print("Summary:", result.data.get("summary"))

# ── Create a child span ─────────────────────────────────────────────────────

child_span = opper.spans.create(
    name="enrichment-step",
    trace_id=root_span.trace_id,
    parent_id=root_span.id,
    start_time=datetime.now(timezone.utc).isoformat(),
    input="Enriching the summary",
)

print("\n── Child span created ──")
print("Child span ID:", child_span.id)
print("Parent:", child_span.parent_id)

enriched = opper.call(
    "sdk-test-extract",
    input={"text": result.data.get("summary", "")},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={"type": "object", "properties": {"keywords": {"type": "array", "items": {"type": "string"}}}},
    parent_span_id=child_span.id,
)

print("Keywords:", enriched.data.get("keywords"))

# ── Update spans with output and end time ───────────────────────────────────

opper.spans.update(
    child_span.id,
    output=json.dumps({"keywords": enriched.data.get("keywords")}),
    end_time=datetime.now(timezone.utc).isoformat(),
)

opper.spans.update(
    root_span.id,
    output=json.dumps({"summary": result.data.get("summary")}),
    end_time=datetime.now(timezone.utc).isoformat(),
    meta={"total_calls": 2},
)

print("\n── Spans closed ──")
print(f"View trace: trace_id={root_span.trace_id}")
