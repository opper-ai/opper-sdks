# List available models with filtering by type
from opperai import Opper

opper = Opper()

# ── All models ──────────────────────────────────────────────────────────────

all_models = opper.models.list(limit=500)
print(f"── All models: {len(all_models.models)} ──")

# ── Filter by type ──────────────────────────────────────────────────────────

types = ["llm", "embedding", "image", "video", "tts", "stt", "rerank", "ocr", "realtime"]

for model_type in types:
    response = opper.models.list(type=model_type, limit=500)
    models = response.models
    if not models:
        continue

    print(f"\n── {model_type} models ({len(models)}) ──")
    for model in models[:5]:
        print(f"  {model.id} ({model.provider})")
    if len(models) > 5:
        print(f"  ... and {len(models) - 5} more")

# ── Filter by provider ──────────────────────────────────────────────────────

print("\n── Anthropic LLMs ──")
anthropic = opper.models.list(type="llm", provider="anthropic")
for model in anthropic.models:
    print(f"  {model.id}")

# ── Search ──────────────────────────────────────────────────────────────────

print("\n── Search: 'claude' ──")
search = opper.models.list(q="claude")
for model in search.models:
    print(f"  {model.id} ({model.provider})")
