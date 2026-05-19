// Reasoning effort and reasoning summaries (added in 4.0.0-beta.13).
//
// `reasoning_effort` controls how much thinking budget reasoning-capable models
// (OpenAI o-series, Anthropic extended thinking, etc.) spend on a request.
// `reasoning_summary` opts into thought-summary streaming when supported.
//
// This example also confirms `ResponseMeta.tool_calls` is surfaced when the
// server reports tool calls — useful for telemetry around tool-using calls.
import { z } from "zod";
import { Opper } from "../../src/index.js";

const opper = new Opper();

// ── reasoning_effort on a reasoning-capable model ───────────────────────────

const result = await opper.call("sdk-test-reasoning", {
  input: "A farmer has 17 sheep. All but 9 die. How many are left? Think step by step.",
  model: "openai/gpt-5.1",
  reasoning_effort: "low",
});

console.log("Answer:", result.data);
console.log("Reasoning tokens:", result.meta?.usage?.reasoning_tokens);

// ── reasoning_summary opt-in ────────────────────────────────────────────────

const result2 = await opper.call("sdk-test-reasoning-summary", {
  input: "Explain why the sky appears blue.",
  model: "openai/gpt-5.1",
  reasoning_effort: "low",
  reasoning_summary: "auto",
});

console.log("\nAnswer:", result2.data);

// ── ResponseMeta.tool_calls surface check ───────────────────────────────────

const toolResult = await opper.call("sdk-test-tool-meta", {
  input: "What is the weather in Paris?",
  model: "anthropic/claude-sonnet-4.6",
  output_schema: z.object({
    answer: z.string().optional(),
    tool_calls: z
      .array(
        z.object({
          name: z.string(),
          arguments: z.record(z.string(), z.unknown()),
        }),
      )
      .optional(),
  }),
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: z.object({ city: z.string() }),
    },
  ],
});

console.log("\nmeta keys:", Object.keys(toolResult.meta ?? {}).sort());
console.log("meta.tool_calls:", JSON.stringify(toolResult.meta?.tool_calls, null, 2));
