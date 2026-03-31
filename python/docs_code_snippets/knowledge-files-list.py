import time
from opperai import Opper

opper = Opper()

# Setup
kb = opper.knowledge.create(name=f"docs-snippet-{int(time.time())}")
opper.knowledge.upload_file(kb.id, b"test content", filename="document.txt")

# --- docs ---
files = opper.knowledge.list_files(kb.id)
for f in files:
    print(f"{f.original_filename} ({f.size} bytes, status: {f.status})")
# --- /docs ---

# Cleanup
opper.knowledge.delete(kb.id)
