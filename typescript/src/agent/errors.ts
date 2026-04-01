// =============================================================================
// Agent Layer — Error Classes
// =============================================================================

import type { RunResult, ToolCallRecord } from "./types.js";

/** Base error for all agent-related errors. */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

/** Thrown when the agent hits the iteration limit without completing. */
export class MaxIterationsError extends AgentError {
  constructor(
    public readonly iterations: number,
    public readonly lastOutput: unknown,
    public readonly toolCalls: ToolCallRecord[],
  ) {
    super(`Agent hit max iterations limit (${iterations}) without completing`);
    this.name = "MaxIterationsError";
  }
}

/** Thrown when the agent run is aborted via AbortSignal. */
export class AbortError extends AgentError {
  constructor() {
    super("Agent run was aborted");
    this.name = "AbortError";
  }
}
