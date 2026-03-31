import time
from opperai import Opper

opper = Opper()

# Setup
kb = opper.knowledge.create(name=f"docs-snippet-{int(time.time())}")

# --- docs ---
opper.knowledge.delete(kb.id)
# --- /docs ---
