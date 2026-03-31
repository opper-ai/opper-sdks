import time
from opperai import Opper

opper = Opper()

# Setup
kb = opper.knowledge.create(name=f"docs-snippet-{int(time.time())}")
opper.knowledge.add(
    kb.id,
    content="Some outdated content.",
    metadata={"source": "outdated"},
)

# --- docs ---
# Delete documents matching filters
opper.knowledge.delete_documents(
    kb.id,
    filters=[{"field": "source", "operation": "=", "value": "outdated"}],
)
# --- /docs ---

# Cleanup
opper.knowledge.delete(kb.id)
