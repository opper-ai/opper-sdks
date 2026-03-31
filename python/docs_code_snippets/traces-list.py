from opperai import Opper

opper = Opper()

# --- docs ---
traces = opper.traces.list(limit=5)
for t in traces.data:
    print(f"{t.id} - {t.name or '(unnamed)'} ({t.span_count} spans)")
# --- /docs ---
