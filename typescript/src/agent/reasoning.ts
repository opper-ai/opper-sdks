// =============================================================================
// Agent Layer — Reasoning Helpers
// =============================================================================

import type { OROutputItem } from "./types.js";

/**
 * Extract reasoning summary text from response output items.
 * Returns the concatenated summary text, or undefined if no reasoning present.
 */
export function extractReasoning(output: OROutputItem[]): string | undefined {
  for (const item of output) {
    if (item.type === "reasoning" && item.summary.length > 0) {
      const text = item.summary.map((s) => s.text).join("");
      return text || undefined;
    }
  }
  return undefined;
}

/**
 * Push a reasoning string into the accumulator array.
 */
export function accumulateReasoning(collected: string[], text: string): void {
  collected.push(text);
}
