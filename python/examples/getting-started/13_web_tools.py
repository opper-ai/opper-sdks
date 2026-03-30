# Web tools: search the web and fetch URL content
from opperai import Opper

opper = Opper()

# ── Web search ──────────────────────────────────────────────────────────────

print("── Web search ──")
search_results = opper.beta.web.search(query="Opper AI platform")

for result in search_results.results[:5]:
    print(f"  {result.title}")
    print(f"  {result.url}")
    print(f"  {result.snippet}\n")

# ── Fetch URL content ───────────────────────────────────────────────────────

print("── Fetch URL ──")
page = opper.beta.web.fetch(url="https://docs.opper.ai")
print("Content (first 500 chars):", page.content[:500] + "...")
