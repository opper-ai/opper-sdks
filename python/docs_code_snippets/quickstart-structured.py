from pydantic import BaseModel
from opperai import Opper

opper = Opper()


class SentimentResult(BaseModel):
    sentiment: str
    confidence: float
    reasoning: str


# --- docs ---
result = opper.call(
    "analyze-sentiment",
    instructions="Analyze the sentiment of the given text",
    input={"text": "The product launch exceeded all expectations!"},
    output_schema=SentimentResult,
)

print(result.data.sentiment, result.data.confidence)
print(result.data.reasoning)
# --- /docs ---
