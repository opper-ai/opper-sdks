import sys
from opperai import Opper

opper = Opper()

# --- docs ---
for chunk in opper.stream(
    "respond",
    instructions="Respond in Swedish",
    input="What are the benefits of using an AI gateway?",
):
    if chunk.type == "content":
        sys.stdout.write(chunk.delta)
        sys.stdout.flush()
    elif chunk.type == "done":
        print()
# --- /docs ---
