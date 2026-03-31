import time
from opperai import Opper

opper = Opper()

# Setup
kb = opper.knowledge.create(name=f"docs-snippet-{int(time.time())}")

# --- docs ---
opper.knowledge.add(
    kb.id,
    content="TypeScript is a typed superset of JavaScript.",
    metadata={"source": "docs", "topic": "typescript"},
)
# --- /docs ---

# Cleanup
opper.knowledge.delete(kb.id)
