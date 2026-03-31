import time
from opperai import Opper

opper = Opper()

# Setup
kb = opper.knowledge.create(name=f"docs-snippet-{int(time.time())}")

# --- docs ---
uploaded = opper.knowledge.upload_file(
    kb.id,
    b"test content",
    filename="document.txt",
    metadata={"source": "upload"},
)
print(f"Uploaded: {uploaded.original_filename} -> {uploaded.document_id}")
# --- /docs ---

# Cleanup
opper.knowledge.delete(kb.id)
