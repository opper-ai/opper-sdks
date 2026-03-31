import time
from opperai import Opper

opper = Opper()

# Setup
kb = opper.knowledge.create(name=f"docs-snippet-{int(time.time())}")
opper.knowledge.add(
    kb.id,
    content="TypeScript is a typed superset of JavaScript.",
    metadata={"source": "docs"},
)
time.sleep(2)  # wait for indexing

# --- docs ---
results = opper.knowledge.query(kb.id, query="typed language for web", top_k=3)
for r in results:
    print(f"[{r.score:.3f}] {r.content[:80]}")
# --- /docs ---

# Cleanup
opper.knowledge.delete(kb.id)
