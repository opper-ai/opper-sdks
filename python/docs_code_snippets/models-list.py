from opperai import Opper

opper = Opper()

# --- docs ---
# List all models
all_models = opper.models.list()
for model in all_models.models[:5]:
    print(f"{model.id} ({model.provider})")

# Filter by type
llms = opper.models.list(type="llm", provider="anthropic")
for model in llms.models:
    print(f"{model.id}")
# --- /docs ---
