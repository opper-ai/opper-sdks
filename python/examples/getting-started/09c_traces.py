# Traces API: list, get, and inspect traces with their spans
from datetime import datetime, timezone
from opperai import Opper

opper = Opper()

# ── Create a trace by running some calls under trace() ──────────────────────

trace_id = None

with opper.trace("sdk-test-trace-demo") as span:
    trace_id = span.trace_id

    opper.call(
        "sdk-test-summarize",
        input={"text": "Traces group related spans together for observability."},
        output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
    )

    opper.call(
        "sdk-test-extract",
        input={"text": "Each function call becomes a child span in the trace."},
        output_schema={"type": "object", "properties": {"keywords": {"type": "array", "items": {"type": "string"}}}},
    )

print("── Trace created via trace() ──\n")

# ── List recent traces ──────────────────────────────────────────────────────

traces = opper.traces.list(limit=5)
print(f"Recent traces ({len(traces.data)}):")
for t in traces.data:
    print(f"  {t.id} — {t.name or '(unnamed)'} ({t.span_count} spans, {t.duration_ms or '?'}ms)")

# ── Get the trace we just created ───────────────────────────────────────────

if trace_id:
    try:
        trace = opper.traces.get(trace_id)
        print(f"\n── Trace detail: {trace.id} ──")
        print(f"Name:   {trace.name or '(unnamed)'}")
        print(f"Spans:  {trace.span_count}")
        print(f"Status: {trace.status or 'unknown'}")

        for s in trace.spans:
            indent = "    " if s.parent_id else "  "
            error_str = f" ERROR: {s.error}" if s.error else ""
            print(f"{indent}↳ {s.name} ({s.id[:8]}…){error_str}")
    except Exception:
        print("\n── getTrace skipped (server returned error) ──")

# ── Get and inspect a specific span ─────────────────────────────────────────

root_span = opper.spans.create(
    name="sdk-test-span-inspection",
    start_time=datetime.now(timezone.utc).isoformat(),
    input="Testing span get",
    meta={"source": "example"},
)

opper.spans.update(
    root_span.id,
    output="Done",
    end_time=datetime.now(timezone.utc).isoformat(),
)

fetched = opper.spans.get(root_span.id)
print(f"\n── Span detail ──")
print(f"ID:       {fetched.id}")
print(f"Name:     {fetched.name}")
print(f"Trace:    {fetched.trace_id}")

# ── Clean up ────────────────────────────────────────────────────────────────

opper.spans.delete(root_span.id)
print(f"\nDeleted test span {root_span.id[:8]}…")
