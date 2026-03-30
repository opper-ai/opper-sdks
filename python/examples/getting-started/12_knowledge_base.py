# Knowledge Base — store, index, and query documents using semantic search
from pathlib import Path

from opperai import Opper

opper = Opper()
KB_NAME = "sdk-example-kb-python"

# ── Create a knowledge base ─────────────────────────────────────────────────

kb = opper.knowledge.create(name=KB_NAME)
print("Created KB:", kb.id, kb.name)

# ── Add documents ───────────────────────────────────────────────────────────

opper.knowledge.add(
    kb.id,
    content="TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
    metadata={"source": "docs", "topic": "typescript"},
)

opper.knowledge.add(
    kb.id,
    content="Python is a high-level, interpreted programming language known for its readability.",
    metadata={"source": "docs", "topic": "python"},
)

opper.knowledge.add(
    kb.id,
    content="Rust is a systems programming language focused on safety, speed, and concurrency.",
    metadata={"source": "docs", "topic": "rust"},
)

print("\nAdded 3 documents")

# ── Query the knowledge base ────────────────────────────────────────────────

results = opper.knowledge.query(kb.id, query="typed language for web development", top_k=2)

print("\n── Query: 'typed language for web development' ──")
for r in results:
    print(f"  [{r.score:.3f}] {r.content[:80]}...")

# ── Query with filters ──────────────────────────────────────────────────────

filtered = opper.knowledge.query(
    kb.id,
    query="programming language",
    filters=[{"field": "topic", "operation": "=", "value": "rust"}],
)

print("\n── Filtered query (topic=rust) ──")
for r in filtered:
    print(f"  [{r.score:.3f}] {r.content[:80]}...")

# ── Upload a file ──────────────────────────────────────────────────────────

pdf_path = Path(__file__).parent / "media" / "sample.pdf"
uploaded = opper.knowledge.upload_file(
    kb.id,
    pdf_path.read_bytes(),
    filename="sample.pdf",
    metadata={"source": "file", "type": "pdf"},
)
print("\nUploaded file:", uploaded.original_filename, "→ document", uploaded.document_id)

# ── List files ─────────────────────────────────────────────────────────────

files = opper.knowledge.list_files(kb.id)
print("\nFiles in KB:")
for f in files:
    print(f"  {f.original_filename} ({f.size} bytes, status: {f.status})")

# ── Get KB info ─────────────────────────────────────────────────────────────

info = opper.knowledge.get_by_name(KB_NAME)
print("\nKB info:", {"name": info.name, "count": info.count, "model": info.embedding_model})

# ── Cleanup ─────────────────────────────────────────────────────────────────

opper.knowledge.delete(kb.id)
print("\nDeleted KB:", kb.id)
