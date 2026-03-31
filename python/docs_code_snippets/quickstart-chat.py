from pydantic import BaseModel
from opperai import Opper

opper = Opper()


class ChatOutput(BaseModel):
    reply: str
    topic: str


# --- docs ---
result = opper.call(
    "chat",
    instructions="You are a helpful assistant",
    input={
        "messages": [
            {"role": "user", "content": "What is the best way to handle retries?"},
            {"role": "assistant", "content": "Exponential backoff is a common approach."},
            {"role": "user", "content": "Can you show me a simple example?"},
        ]
    },
    output_schema=ChatOutput,
)

print(result.data.reply)
# --- /docs ---
