// =============================================================================
// Agent Layer — Model capability lookup for the structured-output-with-tools fallback
// =============================================================================
//
// Some providers / models routed through Opper do not accept a JSON-schema
// response format and a non-empty `tools` array in the same request. For
// those, the agent loop falls back to a synthetic `final_answer` tool whose
// `parameters` is the requested `outputSchema`; the model returns its
// structured answer by calling that tool.
//
// This module is the lookup that decides which path to take. The whitelist is
// intentionally narrow: when in doubt, prefer the fallback (it works
// everywhere) over sending a request that errors out at the provider.

import type { Model, ModelConfig } from "../types.js";

export type StructuredOutputMode = "auto" | "native" | "tool";

/** Public name of the synthetic tool injected when the fallback is active. */
export const FINAL_ANSWER_TOOL_NAME = "final_answer";

/** Instructions prepended to the system prompt when the fallback is active. */
export const FINAL_ANSWER_INSTRUCTIONS =
  "When you have all the information needed to answer, respond by calling the " +
  `\`${FINAL_ANSWER_TOOL_NAME}\` tool exactly once. Its arguments must match the ` +
  "required output schema. Do not produce a plain-text final answer — only the " +
  `\`${FINAL_ANSWER_TOOL_NAME}\` tool call counts as your response.`;

// Prefix patterns for models known to support structured outputs (JSON schema
// response format) AND a non-empty tools array in the same request. Add new
// entries here as providers' capabilities expand.
const SUPPORTS_STRUCTURED_TOOLS: ReadonlyArray<string> = [
  "openai/",
  "azure/openai/",
  "anthropic/",
  "gcp/gemini-2.",
  "gcp/gemini-3.",
  "google/gemini-2.",
  "google/gemini-3.",
  "vertexai/gemini-2.",
  "vertexai/gemini-3.",
];

/** Extract a single model identifier from the polymorphic `Model` type.
 *
 * For a fallback chain (array), use the first entry — that's what the
 * gateway will try first, and the fallback decision is per-request. If the
 * chain crosses a capability boundary the caller should set
 * `structuredOutputMode` explicitly.
 */
function modelName(model: Model | undefined): string | undefined {
  if (model === undefined) return undefined;
  if (typeof model === "string") return model;
  if (Array.isArray(model)) return model.length > 0 ? modelName(model[0]) : undefined;
  const name = (model as ModelConfig).name;
  return typeof name === "string" ? name : undefined;
}

/** True if `model` is known to accept JSON-schema + tools in one call.
 *
 * Defaults to true when no model is set (the gateway picks a default that
 * we expect to be capable). Returns false for any model not matched by a
 * known-capable prefix.
 */
export function supportsStructuredOutputsWithTools(model: Model | undefined): boolean {
  const name = modelName(model);
  if (!name) return true;
  const lower = name.toLowerCase();
  return SUPPORTS_STRUCTURED_TOOLS.some((p) => lower.startsWith(p));
}

/** Decide whether this request should use the `final_answer` fallback.
 *
 * The fallback only kicks in when *both* tools and an output schema are
 * requested — otherwise the native paths work everywhere.
 *
 * `mode` overrides the capability lookup:
 *   - `"native"`: never fall back (caller knows the model supports it,
 *     or wants to surface a provider error).
 *   - `"tool"`: always fall back (useful for debugging or when a model
 *     was recently broken upstream).
 *   - `"auto"` / undefined: consult the whitelist.
 */
export function useToolFallback(args: {
  model: Model | undefined;
  hasTools: boolean;
  hasOutputSchema: boolean;
  mode: StructuredOutputMode | undefined;
}): boolean {
  if (!(args.hasTools && args.hasOutputSchema)) return false;
  if (args.mode === "native") return false;
  if (args.mode === "tool") return true;
  return !supportsStructuredOutputsWithTools(args.model);
}
