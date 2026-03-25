# Function management: list, get, update, delete, revisions
import sys
from opperai import Opper

opper = Opper()

# ── List functions ──────────────────────────────────────────────────────────

functions = opper.functions.list()
print("── List functions ──")
print(f"Found {len(functions)} cached function(s)")
for fn in functions[:5]:
    print(f"  - {fn.name} (hits: {fn.hit_count}, has_script: {fn.has_script})")

# ── Call a function (creates it if it doesn't exist) ────────────────────────

print("\n── Call function ──")
result = opper.call(
    "sdk-test-managed-fn",
    input={"text": "Functions are auto-created on first call and cached for reuse."},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
    model="anthropic/claude-sonnet-4.6",
)
print("Result:", result.data.get("summary"))

# ── Get function details ────────────────────────────────────────────────────

print("\n── Get function details ──")
details = opper.functions.get("sdk-test-managed-fn")
print("  Name:", details.name)
print("  Schema hash:", details.schema_hash)
print("  Generated at:", details.generated_at)
print("  Hit count:", details.hit_count)
print("  Script source (first 100 chars):", details.source[:100] + "...")

# ── List revisions ──────────────────────────────────────────────────────────

print("\n── Revisions ──")
revisions = opper.functions.list_revisions("sdk-test-managed-fn")
print(f"  {len(revisions)} revision(s)")
for rev in revisions:
    print(f"  - rev {rev.revision_id} ({rev.created_at}, current: {rev.is_current})")

if revisions:
    rev_detail = opper.functions.get_revision("sdk-test-managed-fn", revisions[0].revision_id)
    print(f"\n  Revision {rev_detail.revision_id} source (first 100 chars):", rev_detail.source[:100] + "...")

# ── Stream a function ───────────────────────────────────────────────────────

print("\n── Stream function ──")
sys.stdout.write("  ")
for chunk in opper.stream(
    "sdk-test-managed-fn",
    input={"text": "Streaming works on any function, cached or not."},
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
    model="anthropic/claude-sonnet-4.6",
):
    if chunk.type == "content":
        sys.stdout.write(chunk.delta)
        sys.stdout.flush()
    if chunk.type == "done":
        print()

# ── Delete function (cleanup) ───────────────────────────────────────────────

print("\n── Delete function ──")
opper.functions.delete("sdk-test-managed-fn")
print("  Deleted sdk-test-managed-fn")
