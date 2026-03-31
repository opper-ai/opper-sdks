import time
from opperai import Opper

opper = Opper()

# Setup
kb_name = f"docs-snippet-{int(time.time())}"
kb = opper.knowledge.create(name=kb_name)

# --- docs ---
kb = opper.knowledge.get_by_name(kb_name)
print(f"Name: {kb.name}, Docs: {kb.count}, Model: {kb.embedding_model}")
# --- /docs ---

# Cleanup
opper.knowledge.delete(kb.id)
