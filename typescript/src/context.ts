// =============================================================================
// Opper SDK - Trace Context (AsyncLocalStorage)
// =============================================================================

import { AsyncLocalStorage } from "node:async_hooks";

/** The current trace context, propagated automatically via AsyncLocalStorage. */
export interface TraceContext {
  readonly spanId: string;
  readonly traceId: string;
  /** Set by tool tracing wrappers so sub-agents skip redundant span creation. */
  readonly isToolSpan?: boolean;
}

const traceStore = new AsyncLocalStorage<TraceContext>();

/** Get the current trace context, if inside a `traced()` block. */
export function getTraceContext(): TraceContext | undefined {
  return traceStore.getStore();
}

/** Run a function with the given trace context. */
export function runWithTraceContext<T>(ctx: TraceContext, fn: () => T): T {
  return traceStore.run(ctx, fn);
}
