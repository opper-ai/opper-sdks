# Basic function execution with call()
from opperai import Opper

opper = Opper()

result = opper.call("my-first-call", input="In one sentence, What is Python?")

print("Full result object:", result)
