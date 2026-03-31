import sys
from opperai import Opper

opper = Opper()

# --- docs ---
for chunk in opper.stream(
    "creative_writer",
    instructions="Write a short story about a robot learning to paint.",
    input={"topic": "robot artist"},
):
    if chunk.type == "content":
        sys.stdout.write(chunk.delta)
        sys.stdout.flush()
    elif chunk.type == "done":
        print()
# --- /docs ---
