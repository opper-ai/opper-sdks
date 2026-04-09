// =============================================================================
// Agent Layer — Conversation (Multi-Turn)
// =============================================================================

import type { Agent } from "./index.js";
import type { AgentStream } from "./stream.js";
import type { InferAgentOutput, ORInputItem, RunOptions, RunResult, SchemaLike } from "./types.js";

/**
 * A stateful multi-turn conversation with an agent.
 *
 * Tracks the full items history across `.send()` calls so the agent
 * sees prior turns as context. Each send appends the user message and
 * the assistant's response (including any tool calls) to the history.
 *
 * @example
 * ```typescript
 * const agent = new Agent({ name: 'assistant', instructions: 'Be helpful.' });
 * const conversation = agent.conversation();
 *
 * const r1 = await conversation.send('My name is Alice.');
 * const r2 = await conversation.send('What is my name?');
 * // r2.output mentions "Alice" — the agent remembers from the prior turn
 * ```
 */
export class Conversation<S extends SchemaLike | undefined = undefined> {
  private readonly agent: Agent<S>;
  private readonly items: ORInputItem[] = [];

  constructor(agent: Agent<S>) {
    this.agent = agent;
  }

  /**
   * Send a message and run the agent to completion.
   *
   * The user message and the full agent response (including tool call
   * items) are appended to the conversation history.
   */
  async send(input: string, options?: RunOptions): Promise<RunResult<InferAgentOutput<S>>> {
    this.items.push({ type: "message", role: "user", content: input });

    const result = await this.agent.run([...this.items], options);

    // Append assistant response as a message item for future context
    const outputText =
      typeof result.output === "string" ? result.output : JSON.stringify(result.output);

    // Append tool call items if any were made
    for (const tc of result.meta.toolCalls) {
      this.items.push({
        type: "function_call",
        call_id: tc.callId,
        name: tc.name,
        arguments: typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input),
      });
      this.items.push({
        type: "function_call_output",
        call_id: tc.callId,
        output: tc.error ? JSON.stringify({ error: tc.error }) : JSON.stringify(tc.output),
      });
    }

    this.items.push({
      type: "message",
      role: "assistant",
      content: outputText ?? "",
    });

    return result;
  }

  /**
   * Send a message and stream the agent's response.
   *
   * Important: the conversation history is only updated after the stream
   * completes (i.e. after you consume the stream or call `.result()`).
   */
  stream(input: string, options?: RunOptions): AgentStream<InferAgentOutput<S>> {
    this.items.push({ type: "message", role: "user", content: input });

    const stream = this.agent.stream([...this.items], options);

    const originalResult = stream.result.bind(stream);
    stream.result = async () => {
      const result = await originalResult();

      const outputText =
        typeof result.output === "string" ? result.output : JSON.stringify(result.output);

      for (const tc of result.meta.toolCalls) {
        this.items.push({
          type: "function_call",
          call_id: tc.callId,
          name: tc.name,
          arguments: typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input),
        });
        this.items.push({
          type: "function_call_output",
          call_id: tc.callId,
          output: tc.error ? JSON.stringify({ error: tc.error }) : JSON.stringify(tc.output),
        });
      }

      this.items.push({
        type: "message",
        role: "assistant",
        content: outputText ?? "",
      });

      return result;
    };

    return stream;
  }

  /** Get the current conversation history as items. */
  getItems(): readonly ORInputItem[] {
    return this.items;
  }

  /** Clear the conversation history. */
  clear(): void {
    this.items.length = 0;
  }
}
