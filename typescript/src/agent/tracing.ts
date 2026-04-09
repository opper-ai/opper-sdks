// =============================================================================
// Agent Layer — Tracing (Opper Observability)
// =============================================================================

import type { SpansClient } from "../clients/spans.js";
import { getTraceContext } from "../context.js";
import type { Hooks } from "./types.js";

// ---------------------------------------------------------------------------
// mergeHooks — compose two Hooks objects
// ---------------------------------------------------------------------------

const HOOK_KEYS: (keyof Hooks)[] = [
  "onAgentStart",
  "onAgentEnd",
  "onIterationStart",
  "onIterationEnd",
  "onLLMCall",
  "onLLMResponse",
  "onToolStart",
  "onToolEnd",
];

/**
 * Merge two Hooks objects so both run for each event.
 * Hooks from `a` fire first, then `b`. Returns `undefined` if both are undefined.
 */
export function mergeHooks(a?: Hooks, b?: Hooks): Hooks | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;

  const merged: Hooks = {};

  for (const key of HOOK_KEYS) {
    const fa = a[key] as ((ctx: never) => void | Promise<void>) | undefined;
    const fb = b[key] as ((ctx: never) => void | Promise<void>) | undefined;

    if (fa && fb) {
      (merged as Record<string, unknown>)[key] = async (ctx: never) => {
        await Promise.resolve(fa(ctx));
        await Promise.resolve(fb(ctx));
      };
    } else if (fa || fb) {
      (merged as Record<string, unknown>)[key] = fa ?? fb;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// createToolTracingHooks — tool-level spans via SpansClient
// ---------------------------------------------------------------------------

/**
 * Create hooks that manage tool-level child spans.
 *
 * Reads the current ALS trace context (set by TracedAgent) to determine
 * parent span and trace IDs. If no context is active, hooks are no-ops.
 */
export function createToolTracingHooks(spansClient: SpansClient): Hooks {
  const toolSpans = new Map<string, string>();

  return {
    onToolStart: async (ctx) => {
      const traceCtx = getTraceContext();
      if (!traceCtx) return;

      try {
        const span = await spansClient.create({
          name: ctx.name,
          start_time: new Date().toISOString(),
          input: JSON.stringify(ctx.input),
          trace_id: traceCtx.traceId,
          parent_id: traceCtx.spanId,
        });
        toolSpans.set(ctx.callId, span.id);
      } catch {
        // Tracing failures should never break the agent
      }
    },

    onToolEnd: async (ctx) => {
      const spanId = toolSpans.get(ctx.callId);
      if (!spanId) return;

      try {
        await spansClient.update(spanId, {
          end_time: new Date().toISOString(),
          ...(ctx.error ? { error: ctx.error } : {}),
          ...(ctx.output !== undefined ? { output: JSON.stringify(ctx.output) } : {}),
        });
      } catch {
        // Tracing failures should never break the agent
      }

      toolSpans.delete(ctx.callId);
    },
  };
}
