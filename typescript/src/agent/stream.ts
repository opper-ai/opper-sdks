// =============================================================================
// Agent Layer — AgentStream
// =============================================================================

import type { AgentStreamEvent, RunResult } from "./types.js";

/**
 * A stream of agent events that also provides access to the final result.
 *
 * Supports two usage patterns:
 *
 * 1. **Iterate events** — observe progress, show UI, log:
 * ```typescript
 * const stream = agent.stream("What is 2+2?");
 * for await (const event of stream) {
 *   if (event.type === "text_delta") process.stdout.write(event.text);
 * }
 * ```
 *
 * 2. **Iterate events, then get result**:
 * ```typescript
 * const stream = agent.stream("What is 2+2?");
 * for await (const event of stream) { ... }
 * const result = await stream.result();
 * console.log(result.output);
 * ```
 */
export class AgentStream<TOutput = unknown> implements AsyncIterable<AgentStreamEvent> {
  private generator: AsyncGenerator<AgentStreamEvent, void, undefined>;
  private resolvedResult: RunResult<TOutput> | undefined;
  private resultPromise: Promise<RunResult<TOutput>>;
  private resolveResult!: (result: RunResult<TOutput>) => void;
  private rejectResult!: (error: Error) => void;
  private iterationStarted = false;

  constructor(generator: AsyncGenerator<AgentStreamEvent, void, undefined>) {
    this.generator = generator;
    this.resultPromise = new Promise<RunResult<TOutput>>((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
    });
    // Prevent unhandled rejection if the caller never calls .result()
    this.resultPromise.catch(() => {});
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<AgentStreamEvent> {
    if (this.iterationStarted) {
      throw new Error("AgentStream can only be iterated once");
    }
    this.iterationStarted = true;

    try {
      for await (const event of this.generator) {
        // Capture the result event to resolve the result promise
        if (event.type === "result") {
          this.resolvedResult = {
            output: event.output as TOutput,
            meta: event.meta,
          };
          this.resolveResult(this.resolvedResult);
        }

        yield event;
      }

      // If we finished without a result event (shouldn't happen in normal flow),
      // reject the promise so .result() doesn't hang
      if (!this.resolvedResult) {
        this.rejectResult(new Error("Stream ended without a result"));
      }
    } catch (err) {
      this.rejectResult(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Get the final result after the stream completes.
   *
   * If the stream hasn't been iterated yet, this will consume it fully.
   * If the stream has been iterated, returns the captured result.
   */
  async result(): Promise<RunResult<TOutput>> {
    // If already resolved, return immediately
    if (this.resolvedResult) return this.resolvedResult;

    // If not yet iterated, drain the stream to get the result
    if (!this.iterationStarted) {
      for await (const _ of this) {
        // drain
      }
    }

    return this.resultPromise;
  }
}
