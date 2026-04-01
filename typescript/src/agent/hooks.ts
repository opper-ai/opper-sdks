// =============================================================================
// Agent Layer — Hook Dispatch
// =============================================================================

import type { Hooks } from "./types.js";

type HookName = keyof Hooks;

/**
 * Safely dispatch a lifecycle hook.
 *
 * - No-ops if the hook is not defined.
 * - Awaits async hooks.
 * - Catches and warns on errors — hooks should never crash the loop.
 */
export async function dispatchHook<K extends HookName>(
  hooks: Hooks | undefined,
  name: K,
  // biome-ignore lint/suspicious/noExplicitAny: hook context types vary per key
  ctx: Parameters<NonNullable<Hooks[K]>>[0] extends infer C ? C : any,
): Promise<void> {
  if (!hooks) return;

  const fn = hooks[name];
  if (!fn) return;

  try {
    // biome-ignore lint/suspicious/noExplicitAny: context type is correct at call site
    await Promise.resolve((fn as any)(ctx));
  } catch (err) {
    console.warn(`[opper] Hook "${name}" threw:`, err);
  }
}
