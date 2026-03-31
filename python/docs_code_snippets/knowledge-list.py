from opperai import Opper

opper = Opper()

# --- docs ---
knowledge_bases = opper.knowledge.list()
for kb in knowledge_bases:
    print(f"{kb.name} (id: {kb.id})")
# --- /docs ---
