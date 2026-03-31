from opperai import Opper

opper = Opper()

# --- docs ---
result = opper.call(
    "respond",
    instructions="Respond in Swedish",
    input="What are the benefits of using an AI gateway?",
)

print(result.data)
# --- /docs ---
