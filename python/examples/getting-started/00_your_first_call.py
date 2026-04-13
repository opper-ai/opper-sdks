# Basic function execution with call()
from opperai import ModelConfig, Opper

opper = Opper()

result = opper.call("my-first-call", input="In one sentence, What is Python?")

print("Full result object:", result)

# You can also specify a model — as a string or with provider-specific options
result2 = opper.call(
    "my-first-call",
    input="In one sentence, What is Python?",
    model=ModelConfig(name="anthropic/claude-sonnet-4-6", options={"max_tokens": 100}),
)

print("With model options:", result2.data)
