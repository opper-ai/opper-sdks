# Observability: automatic tracing with @trace and context manager
from opperai import Opper

opper = Opper()

# ── Automatic tracing (context manager) ──────────────────────────────────────

with opper.trace("summarize-flow") as span:
    summary = opper.call(
        "sdk-test-summarize",
        input={"text": "Observability is key to understanding system behavior in production."},
        output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
    )
    print("Summary:", summary.data.get("summary"))

# ── Nested traces ────────────────────────────────────────────────────────────

with opper.trace("multi-step-pipeline"):
    extracted = opper.call(
        "sdk-test-extract",
        input={"text": "What is the story of Arthur? It is a tale of bravery and adventure and also some dragons."},
        output_schema={"type": "object", "properties": {"keywords": {"type": "array", "items": {"type": "string"}}}},
    )
    print("Keywords:", extracted.data.get("keywords"))

    with opper.trace("enrich"):
        enriched = opper.call(
            "sdk-test-summarize",
            input={"keywords": extracted.data.get("keywords")},
            output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
        )
        print("Enriched:", enriched.data.get("summary"))

# ── Span handle for metadata ────────────────────────────────────────────────

with opper.trace(name="with-metadata", meta={"userId": "u-123"}, tags={"env": "example"}) as span:
    print("Trace:", span.trace_id, "Span:", span.id)

    opper.call(
        "sdk-test-summarize",
        input={"text": "Span handle gives access to trace and span IDs."},
        input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
    )

# ── Decorator pattern ───────────────────────────────────────────────────────


@opper.trace("decorated-pipeline")
def my_pipeline():
    result = opper.call(
        "sdk-test-summarize",
        input={"text": "Decorators are the Pythonic way to trace."},
        output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
    )
    print("Decorated result:", result.data.get("summary"))
    return result


my_pipeline()

# ── Generations ─────────────────────────────────────────────────────────────

generations = opper.generations.list(page=1, page_size=3)
print(f"\nRecent generations: {generations.meta.total_count} total")
for gen in generations.data:
    print(f"  - {gen.get('id')}")
