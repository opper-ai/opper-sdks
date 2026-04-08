// =============================================================================
// Agent Layer — Agentic Loop
// =============================================================================

import type { OpenResponsesClient } from "../clients/openresponses.js";
import { getTraceContext, runWithTraceContext } from "../context.js";
import {
  AuthenticationError,
  InternalServerError,
  RateLimitError,
  type RequestOptions,
} from "../types.js";
import { AbortError, AgentError, MaxIterationsError } from "./errors.js";
import { dispatchHook } from "./hooks.js";
import { resolveToolSchema } from "./index.js";
import { accumulateReasoning, extractReasoning } from "./reasoning.js";
import type {
  AgentStreamEvent,
  AgentTool,
  AggregatedUsage,
  Hooks,
  ORFunctionCallOutputItemResponse,
  ORInputItem,
  OROutputItem,
  ORRequest,
  ORResponse,
  ORStreamEvent,
  ORTool,
  ORUsage,
  RetryPolicy,
  RunOptions,
  RunResult,
  ToolCallRecord,
} from "./types.js";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface LoopConfig {
  name: string;
  traceName: string;
  instructions: string;
  tools: AgentTool[];
  model?: string;
  outputSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  maxIterations: number;
  reasoningEffort?: "low" | "medium" | "high";
  parallelToolExecution: boolean;
  hooks?: Hooks;
  /** Explicit trace context — used when ALS propagation isn't reliable (e.g. streaming). */
  traceContext?: { spanId: string; traceId: string };
  /** Retry policy for transient LLM call failures. */
  retry?: RetryPolicy;
  /** Behavior when max iterations is reached. */
  onMaxIterations?: "throw" | "return_partial";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an AgentTool to the ORTool wire format. */
function toORTool(t: AgentTool): ORTool {
  return {
    type: "function",
    name: t.name,
    ...(t.description ? { description: t.description } : {}),
    ...(t.parameters ? { parameters: t.parameters } : {}),
  };
}

/** Extract text from assistant message output items. */
function extractText(output: OROutputItem[]): string | undefined {
  for (const item of output) {
    if (item.type === "message" && item.role === "assistant") {
      for (const part of item.content) {
        if (part.type === "output_text" && part.text) {
          return part.text;
        }
      }
    }
  }
  return undefined;
}

/** Extract function_call items from output. */
function extractFunctionCalls(output: OROutputItem[]): ORFunctionCallOutputItemResponse[] {
  return output.filter(
    (item): item is ORFunctionCallOutputItemResponse => item.type === "function_call",
  );
}

/** Aggregate usage from an ORUsage into running totals. */
function addUsage(agg: AggregatedUsage, usage?: ORUsage): void {
  if (!usage) return;
  agg.inputTokens += usage.input_tokens;
  agg.outputTokens += usage.output_tokens;
  agg.totalTokens += usage.total_tokens;
  if (usage.input_tokens_details?.cached_tokens) {
    agg.cachedTokens = (agg.cachedTokens ?? 0) + usage.input_tokens_details.cached_tokens;
  }
  if (usage.output_tokens_details?.reasoning_tokens) {
    agg.reasoningTokens = (agg.reasoningTokens ?? 0) + usage.output_tokens_details.reasoning_tokens;
  }
}

// ---------------------------------------------------------------------------
// Error recovery helpers
// ---------------------------------------------------------------------------

const DEFAULT_RETRY: Required<RetryPolicy> = {
  maxRetries: 2,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};

/** Returns true if the error is transient and worth retrying (5xx, 429, network). */
function isRetryable(err: unknown): boolean {
  if (err instanceof AuthenticationError) return false;
  if (err instanceof RateLimitError) return true;
  if (err instanceof InternalServerError) return true;
  // Network errors (fetch failures) surface as TypeError
  if (err instanceof TypeError) return true;
  return false;
}

/** Returns true if the error is fatal and should never be recovered. */
function isFatal(err: unknown): boolean {
  if (err instanceof AbortError) return true;
  if (err instanceof AuthenticationError) return true;
  return false;
}

/** Retry an async operation with exponential backoff for retryable errors. */
async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  hooks: Hooks | undefined,
  agentName: string,
  iteration: number,
  signal?: AbortSignal,
): Promise<T> {
  const { maxRetries, initialDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY,
    ...policy,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw new AbortError();
      if (!isRetryable(err) || attempt === maxRetries) throw err;

      await dispatchHook(hooks, "onError", {
        agent: agentName,
        iteration,
        error: err instanceof Error ? err : new Error(String(err)),
        willRetry: true,
      });

      const delay = initialDelayMs * backoffMultiplier ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/** Create a system message to inject a recovered error into the conversation. */
function errorToItem(message: string): ORInputItem {
  return {
    type: "message",
    role: "system",
    content: `[Error] ${message} — adjust your approach or inform the user.`,
  };
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

/** Execute a single tool call, returning a ToolCallRecord. */
async function executeTool(
  tools: AgentTool[],
  callId: string,
  name: string,
  argsJson: string,
): Promise<ToolCallRecord> {
  const start = Date.now();
  const t = tools.find((tool) => tool.name === name);

  if (!t) {
    return {
      name,
      callId,
      input: argsJson,
      output: undefined,
      error: `Tool "${name}" not found`,
      durationMs: Date.now() - start,
    };
  }

  let parsed: unknown;
  try {
    parsed = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return {
      name,
      callId,
      input: argsJson,
      output: undefined,
      error: `Failed to parse tool arguments: ${argsJson}`,
      durationMs: Date.now() - start,
    };
  }

  try {
    const result = await Promise.resolve(t.execute(parsed));
    return {
      name,
      callId,
      input: parsed,
      output: result,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      callId,
      input: parsed,
      output: undefined,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/** Build the ORRequest from loop config, items, and per-run options. */
function buildRequest(
  config: LoopConfig,
  items: ORInputItem[],
  orTools: ORTool[],
  options?: RunOptions,
): ORRequest {
  return {
    input: items,
    instructions: config.instructions,
    ...(orTools.length > 0 ? { tools: orTools } : {}),
    ...((options?.model ?? config.model) ? { model: options?.model ?? config.model } : {}),
    ...((options?.temperature ?? config.temperature)
      ? { temperature: options?.temperature ?? config.temperature }
      : {}),
    ...((options?.maxTokens ?? config.maxTokens)
      ? { max_output_tokens: options?.maxTokens ?? config.maxTokens }
      : {}),
    ...((options?.reasoningEffort ?? config.reasoningEffort)
      ? { reasoning: { effort: options?.reasoningEffort ?? config.reasoningEffort } }
      : {}),
    ...(config.outputSchema
      ? { text: { format: { type: "json_schema", name: "output", schema: config.outputSchema } } }
      : {}),
  };
}

/** Parse output: extract text and optionally parse structured output. */
function parseOutput(text: string | undefined, outputSchema?: Record<string, unknown>): unknown {
  if (outputSchema && text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/** Merge tracing headers into request options. Uses explicit context first, ALS fallback. */
function withTracingHeaders(
  traceName: string,
  traceContext: { spanId: string; traceId: string } | undefined,
  options?: RequestOptions,
): RequestOptions | undefined {
  const ctx = traceContext ?? getTraceContext();
  if (!ctx) return options;
  return {
    ...options,
    headers: {
      ...options?.headers,
      "X-Opper-Parent-Span-Id": ctx.spanId,
      "X-Opper-Name": traceName,
    },
  };
}

/** Append function calls and their results to the items array. */
function appendToolResults(
  items: ORInputItem[],
  functionCalls: ORFunctionCallOutputItemResponse[],
  toolRecords: ToolCallRecord[],
): void {
  for (const fc of functionCalls) {
    items.push({
      type: "function_call",
      call_id: fc.call_id,
      name: fc.name,
      arguments: fc.arguments,
    });
  }
  for (const record of toolRecords) {
    items.push({
      type: "function_call_output",
      call_id: record.callId,
      output: record.error
        ? JSON.stringify({ error: record.error })
        : JSON.stringify(record.output),
    });
  }
}

/** Execute tool calls with hook dispatch around each tool. */
async function executeToolsWithHooks(
  resolvedTools: AgentTool[],
  functionCalls: ORFunctionCallOutputItemResponse[],
  parallel: boolean,
  hooks: Hooks | undefined,
  agent: string,
  iteration: number,
  traceContext?: { spanId: string; traceId: string },
): Promise<ToolCallRecord[]> {
  const run = async (fc: ORFunctionCallOutputItemResponse): Promise<ToolCallRecord> => {
    let parsed: unknown;
    try {
      parsed = fc.arguments ? JSON.parse(fc.arguments) : {};
    } catch {
      parsed = fc.arguments;
    }

    await dispatchHook(hooks, "onToolStart", {
      agent,
      iteration,
      name: fc.name,
      callId: fc.call_id,
      input: parsed,
    });

    // Set ALS context for tool execution so wrapToolWithTracing can create child spans.
    // Needed for streaming where ALS doesn't propagate through async generators.
    const record = traceContext
      ? await runWithTraceContext(traceContext, () =>
          executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments),
        )
      : await executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments);

    await dispatchHook(hooks, "onToolEnd", {
      agent,
      iteration,
      name: fc.name,
      callId: fc.call_id,
      output: record.output,
      error: record.error,
      durationMs: record.durationMs,
    });

    return record;
  };

  if (parallel) {
    return Promise.all(functionCalls.map(run));
  }
  const records: ToolCallRecord[] = [];
  for (const fc of functionCalls) {
    records.push(await run(fc));
  }
  return records;
}

// ---------------------------------------------------------------------------
// runLoop — non-streaming agentic loop
// ---------------------------------------------------------------------------

/**
 * Execute the agentic loop (non-streaming).
 *
 * 1. Build items array from input
 * 2. Call OpenResponses endpoint
 * 3. If function_calls in output → execute tools → append results → loop
 * 4. If no function_calls → return result
 */
export async function runLoop(
  client: OpenResponsesClient,
  config: LoopConfig,
  input: string | ORInputItem[],
  options?: RunOptions,
): Promise<RunResult> {
  const resolvedTools = await Promise.all(config.tools.map(resolveToolSchema));
  const orTools = resolvedTools.map(toORTool);

  const items: ORInputItem[] =
    typeof input === "string" ? [{ type: "message", role: "user", content: input }] : [...input];

  const usage: AggregatedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const allToolCalls: ToolCallRecord[] = [];
  const allReasoning: string[] = [];
  const maxIterations = options?.maxIterations ?? config.maxIterations;
  const { hooks } = config;
  let lastOutput: unknown;
  let responseId: string | undefined;

  await dispatchHook(hooks, "onAgentStart", { agent: config.name, input });

  try {
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      if (options?.signal?.aborted) throw new AbortError();

      await dispatchHook(hooks, "onIterationStart", { agent: config.name, iteration });

      const request = buildRequest(config, items, orTools, options);

      await dispatchHook(hooks, "onLLMCall", { agent: config.name, iteration, request });

      let response: ORResponse;
      if (config.retry) {
        // Error recovery enabled — retry transient failures, inject errors as context
        try {
          response = await withRetry(
            () =>
              client.create(
                request,
                withTracingHeaders(config.traceName, config.traceContext, options?.requestOptions),
              ),
            config.retry,
            hooks,
            config.name,
            iteration,
            options?.signal,
          );
        } catch (err) {
          if (isFatal(err)) throw err;
          const wrapped = err instanceof Error ? err : new Error(String(err));
          await dispatchHook(hooks, "onError", {
            agent: config.name,
            iteration,
            error: wrapped,
            willRetry: false,
          });
          items.push(errorToItem(wrapped.message));
          continue;
        }
      } else {
        // No retry — legacy behavior, throw immediately
        try {
          response = await client.create(
            request,
            withTracingHeaders(config.traceName, config.traceContext, options?.requestOptions),
          );
        } catch (err) {
          if (options?.signal?.aborted) throw new AbortError();
          throw new AgentError("Server call failed", err);
        }
      }

      await dispatchHook(hooks, "onLLMResponse", { agent: config.name, iteration, response });

      addUsage(usage, response.usage);
      responseId = response.id;

      const reasoning = extractReasoning(response.output);
      if (reasoning) {
        accumulateReasoning(allReasoning, reasoning);
      }

      if (response.error) {
        if (config.retry) {
          const err = new AgentError(`Server error: ${response.error.message}`);
          await dispatchHook(hooks, "onError", {
            agent: config.name,
            iteration,
            error: err,
            willRetry: false,
          });
          items.push(errorToItem(response.error.message));
          continue;
        }
        throw new AgentError(`Server error: ${response.error.message}`);
      }

      const functionCalls = extractFunctionCalls(response.output);

      if (functionCalls.length === 0) {
        const output = parseOutput(extractText(response.output), config.outputSchema);
        const result: RunResult = {
          output,
          meta: {
            usage,
            iterations: iteration,
            toolCalls: allToolCalls,
            responseId,
            ...(allReasoning.length > 0 ? { reasoning: allReasoning } : {}),
          },
        };

        await dispatchHook(hooks, "onIterationEnd", {
          agent: config.name,
          iteration,
          usage: { ...usage },
        });
        await dispatchHook(hooks, "onAgentEnd", { agent: config.name, result });

        return result;
      }

      const toolRecords = await executeToolsWithHooks(
        resolvedTools,
        functionCalls,
        config.parallelToolExecution,
        hooks,
        config.name,
        iteration,
        config.traceContext,
      );
      allToolCalls.push(...toolRecords);
      appendToolResults(items, functionCalls, toolRecords);
      lastOutput = extractText(response.output);

      await dispatchHook(hooks, "onIterationEnd", {
        agent: config.name,
        iteration,
        usage: { ...usage },
      });
    }

    if (config.onMaxIterations === "return_partial") {
      const output = parseOutput(lastOutput as string | undefined, config.outputSchema);
      const result: RunResult = {
        output,
        meta: {
          usage,
          iterations: maxIterations,
          toolCalls: allToolCalls,
          responseId,
          ...(allReasoning.length > 0 ? { reasoning: allReasoning } : {}),
        },
      };
      await dispatchHook(hooks, "onAgentEnd", { agent: config.name, result });
      return result;
    }

    throw new MaxIterationsError(maxIterations, lastOutput, allToolCalls);
  } catch (err) {
    await dispatchHook(hooks, "onAgentEnd", {
      agent: config.name,
      error: err instanceof Error ? err : new Error(String(err)),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// streamLoop — streaming agentic loop
// ---------------------------------------------------------------------------

/** Accumulated state for a single streaming tool call. */
interface PendingToolCall {
  callId: string;
  name: string;
  arguments: string;
  outputIndex: number;
}

/**
 * Process an SSE stream from the OpenResponses endpoint.
 * Yields text_delta events and accumulates function calls internally.
 * Returns the completed ORResponse and collected function calls.
 */
async function* consumeStream(
  stream: AsyncGenerator<ORStreamEvent, void, undefined>,
): AsyncGenerator<
  AgentStreamEvent,
  { response: ORResponse | undefined; functionCalls: ORFunctionCallOutputItemResponse[]; reasoningText: string | undefined }
> {
  const pendingCalls = new Map<number, PendingToolCall>();
  let completedResponse: ORResponse | undefined;
  let reasoningText = "";

  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta":
        yield { type: "text_delta", text: event.delta };
        break;

      case "response.reasoning_summary_text.delta":
        yield { type: "reasoning_delta", text: event.delta };
        break;

      case "response.reasoning_summary_text.done":
        reasoningText = event.text;
        break;

      case "response.function_call_arguments.delta": {
        const existing = pendingCalls.get(event.output_index);
        if (existing) {
          existing.arguments += event.delta;
        }
        break;
      }

      case "response.function_call_arguments.done": {
        const existing = pendingCalls.get(event.output_index);
        if (existing) {
          existing.arguments = event.arguments;
        }
        break;
      }

      case "response.output_item.added": {
        if (event.item.type === "function_call") {
          pendingCalls.set(event.output_index, {
            callId: event.item.call_id,
            name: event.item.name,
            arguments: "",
            outputIndex: event.output_index,
          });
        }
        break;
      }

      case "response.completed":
        completedResponse = event.response;
        break;

      case "response.failed":
      case "response.incomplete":
        completedResponse = event.response;
        break;

      case "error":
        throw new AgentError(`Stream error: ${event.error.message}`);
    }
  }

  // Convert pending calls to ORFunctionCallOutputItemResponse format
  const functionCalls: ORFunctionCallOutputItemResponse[] = [];
  for (const pending of pendingCalls.values()) {
    functionCalls.push({
      type: "function_call",
      id: `fc_${pending.outputIndex}`,
      call_id: pending.callId,
      name: pending.name,
      arguments: pending.arguments,
      status: "completed",
    });
  }

  return { response: completedResponse, functionCalls, reasoningText: reasoningText || undefined };
}

/**
 * Execute the agentic loop (streaming).
 *
 * Same logic as runLoop, but uses createStream() and yields AgentStreamEvents.
 * Text deltas are yielded as they arrive. Tool calls are accumulated from SSE
 * events and executed after the stream completes for each iteration.
 */
export async function* streamLoop(
  client: OpenResponsesClient,
  config: LoopConfig,
  input: string | ORInputItem[],
  options?: RunOptions,
): AsyncGenerator<AgentStreamEvent, void, undefined> {
  const resolvedTools = await Promise.all(config.tools.map(resolveToolSchema));
  const orTools = resolvedTools.map(toORTool);

  const items: ORInputItem[] =
    typeof input === "string" ? [{ type: "message", role: "user", content: input }] : [...input];

  const usage: AggregatedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const allToolCalls: ToolCallRecord[] = [];
  const allReasoning: string[] = [];
  const maxIterations = options?.maxIterations ?? config.maxIterations;
  const { hooks } = config;
  let responseId: string | undefined;

  await dispatchHook(hooks, "onAgentStart", { agent: config.name, input });

  try {
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      if (options?.signal?.aborted) throw new AbortError();

      await dispatchHook(hooks, "onIterationStart", { agent: config.name, iteration });

      yield { type: "iteration_start", iteration };

      const request = buildRequest(config, items, orTools, options);

      await dispatchHook(hooks, "onLLMCall", { agent: config.name, iteration, request });

      let response: ORResponse | undefined;
      let functionCalls: ORFunctionCallOutputItemResponse[];
      let streamRecovered = false;

      if (config.retry) {
        // Error recovery enabled — retry transient failures, buffer events until success
        try {
          const streamResult = await withRetry(
            async () => {
              const sseStream = client.createStream(
                request,
                withTracingHeaders(config.traceName, config.traceContext, options?.requestOptions),
              );
              const events: AgentStreamEvent[] = [];
              const consumer = consumeStream(sseStream);
              let consumerResult: IteratorResult<
                AgentStreamEvent,
                {
                  response: ORResponse | undefined;
                  functionCalls: ORFunctionCallOutputItemResponse[];
                  reasoningText: string | undefined;
                }
              >;
              while (true) {
                consumerResult = await consumer.next();
                if (consumerResult.done) break;
                events.push(consumerResult.value);
              }
              return { events, ...consumerResult.value };
            },
            config.retry,
            hooks,
            config.name,
            iteration,
            options?.signal,
          );

          for (const event of streamResult.events) {
            yield event;
          }
          response = streamResult.response;
          functionCalls = streamResult.functionCalls;
          if (streamResult.reasoningText) {
            accumulateReasoning(allReasoning, streamResult.reasoningText);
          }
        } catch (err) {
          if (isFatal(err)) throw err;
          const wrapped = err instanceof Error ? err : new Error(String(err));
          await dispatchHook(hooks, "onError", {
            agent: config.name,
            iteration,
            error: wrapped,
            willRetry: false,
          });
          items.push(errorToItem(wrapped.message));
          streamRecovered = true;
          functionCalls = [];
        }
      } else {
        // No retry — legacy behavior, stream events directly
        let sseStream: AsyncGenerator<ORStreamEvent, void, undefined>;
        try {
          sseStream = client.createStream(
            request,
            withTracingHeaders(config.traceName, config.traceContext, options?.requestOptions),
          );
        } catch (err) {
          if (options?.signal?.aborted) throw new AbortError();
          throw new AgentError("Server call failed", err);
        }

        const consumer = consumeStream(sseStream);
        let consumerResult: IteratorResult<
          AgentStreamEvent,
          {
            response: ORResponse | undefined;
            functionCalls: ORFunctionCallOutputItemResponse[];
            reasoningText: string | undefined;
          }
        >;
        while (true) {
          consumerResult = await consumer.next();
          if (consumerResult.done) break;
          yield consumerResult.value;
        }

        response = consumerResult.value.response;
        functionCalls = consumerResult.value.functionCalls;
        if (consumerResult.value.reasoningText) {
          accumulateReasoning(allReasoning, consumerResult.value.reasoningText);
        }
      }

      if (streamRecovered) continue;

      if (response) {
        await dispatchHook(hooks, "onLLMResponse", { agent: config.name, iteration, response });
      }

      // Track usage
      if (response?.usage) {
        addUsage(usage, response.usage);
      }
      if (response?.id) {
        responseId = response.id;
      }

      // Check for server error
      if (response?.error) {
        if (config.retry) {
          const err = new AgentError(`Server error: ${response.error.message}`);
          await dispatchHook(hooks, "onError", {
            agent: config.name,
            iteration,
            error: err,
            willRetry: false,
          });
          items.push(errorToItem(response.error.message));
          continue;
        }
        throw new AgentError(`Server error: ${response.error.message}`);
      }

      // No function calls → done
      if (functionCalls.length === 0) {
        const output = parseOutput(
          response ? extractText(response.output) : undefined,
          config.outputSchema,
        );

        const meta = {
          usage,
          iterations: iteration,
          toolCalls: allToolCalls,
          responseId,
          ...(allReasoning.length > 0 ? { reasoning: allReasoning } : {}),
        };

        await dispatchHook(hooks, "onIterationEnd", {
          agent: config.name,
          iteration,
          usage: { ...usage },
        });

        yield { type: "iteration_end", iteration, usage: { ...usage } };

        const result: RunResult = { output, meta };
        await dispatchHook(hooks, "onAgentEnd", { agent: config.name, result });

        yield { type: "result", output, meta };
        return;
      }

      // Execute tools — yield tool_start / tool_end events
      const toolRecords: ToolCallRecord[] = [];

      const executeAndYield = async function* (
        fc: ORFunctionCallOutputItemResponse,
      ): AsyncGenerator<AgentStreamEvent> {
        let parsed: unknown;
        try {
          parsed = fc.arguments ? JSON.parse(fc.arguments) : {};
        } catch {
          parsed = fc.arguments;
        }

        await dispatchHook(hooks, "onToolStart", {
          agent: config.name,
          iteration,
          name: fc.name,
          callId: fc.call_id,
          input: parsed,
        });

        yield { type: "tool_start", name: fc.name, callId: fc.call_id, input: parsed };

        const record = config.traceContext
          ? await runWithTraceContext(config.traceContext, () =>
              executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments),
            )
          : await executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments);
        toolRecords.push(record);

        await dispatchHook(hooks, "onToolEnd", {
          agent: config.name,
          iteration,
          name: fc.name,
          callId: fc.call_id,
          output: record.output,
          error: record.error,
          durationMs: record.durationMs,
        });

        yield {
          type: "tool_end",
          name: fc.name,
          callId: fc.call_id,
          output: record.output,
          error: record.error,
          durationMs: record.durationMs,
        };
      };

      if (config.parallelToolExecution) {
        // Run tools in parallel, but collect events to yield in order
        const toolGenerators = functionCalls.map((fc) => executeAndYield(fc));
        const eventArrays = await Promise.all(
          toolGenerators.map(async (gen) => {
            const events: AgentStreamEvent[] = [];
            for await (const event of gen) {
              events.push(event);
            }
            return events;
          }),
        );
        for (const events of eventArrays) {
          for (const event of events) {
            yield event;
          }
        }
      } else {
        for (const fc of functionCalls) {
          for await (const event of executeAndYield(fc)) {
            yield event;
          }
        }
      }

      allToolCalls.push(...toolRecords);
      appendToolResults(items, functionCalls, toolRecords);

      await dispatchHook(hooks, "onIterationEnd", {
        agent: config.name,
        iteration,
        usage: { ...usage },
      });

      yield { type: "iteration_end", iteration, usage: { ...usage } };
    }

    if (config.onMaxIterations === "return_partial") {
      const result: RunResult = {
        output: undefined,
        meta: {
          usage,
          iterations: maxIterations,
          toolCalls: allToolCalls,
          responseId,
          ...(allReasoning.length > 0 ? { reasoning: allReasoning } : {}),
        },
      };
      await dispatchHook(hooks, "onAgentEnd", { agent: config.name, result });
      yield { type: "result", output: undefined, meta: result.meta };
      return;
    }

    throw new MaxIterationsError(maxIterations, undefined, allToolCalls);
  } catch (err) {
    await dispatchHook(hooks, "onAgentEnd", {
      agent: config.name,
      error: err instanceof Error ? err : new Error(String(err)),
    });
    throw err;
  }
}
