import time
from opperai import Opper

opper = Opper()

kb_name = f"docs-snippet-{int(time.time())}"

# --- docs ---
kb = opper.knowledge.create(name=kb_name)
print(f"Created: {kb.id} ({kb.name})")
# --- /docs ---

# Cleanup
opper.knowledge.delete(kb.id)
