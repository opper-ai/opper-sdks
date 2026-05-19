# Reasoning effort and reasoning summaries (added in 2.0.0b12).
#
# `reasoning_effort` controls how much thinking budget reasoning-capable models
# (OpenAI o-series, Anthropic extended thinking, etc.) spend on a request.
# `reasoning_summary` opts into thought-summary streaming when supported.
#
# This example also confirms `ResponseMeta.tool_calls` is surfaced when the
# server reports tool calls — useful for telemetry around tool-using calls.

from opperai import Opper

opper = Opper()

# ── reasoning_effort on a reasoning-capable model ───────────────────────────

result = opper.call(
    "sdk-test-reasoning",
    input="A farmer has 17 sheep. All but 9 die. How many are left? Think step by step.",
    model="openai/gpt-5.1",
    reasoning_effort="low",
)

print("Answer:", result.data)
if result.meta:
    usage = (result.meta or {}).get("usage") if isinstance(result.meta, dict) else None
    if usage:
        print("Reasoning tokens:", usage.get("reasoning_tokens"))

# ── reasoning_summary opt-in ────────────────────────────────────────────────

result2 = opper.call(
    "sdk-test-reasoning-summary",
    input="Explain why the sky appears blue.",
    model="openai/gpt-5.1",
    reasoning_effort="low",
    reasoning_summary="auto",
)

print("\nAnswer:", result2.data)

# ── ResponseMeta.tool_calls surface check ───────────────────────────────────

tool_result = opper.call(
    "sdk-test-tool-meta",
    input="What is the weather in Paris?",
    model="anthropic/claude-sonnet-4.6",
    output_schema={
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "tool_calls": {"type": "array"},
        },
    },
    tools=[
        {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        }
    ],
)

meta = tool_result.meta if isinstance(tool_result.meta, dict) else {}
print("\nmeta keys:", sorted(meta.keys()))
print("meta.tool_calls:", meta.get("tool_calls"))
print("answer:", tool_result.data)
