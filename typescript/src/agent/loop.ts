// =============================================================================
// Agent Layer — Agentic Loop
// =============================================================================

import type { OpenResponsesClient } from "../clients/openresponses.js";
import { getTraceContext } from "../context.js";
import type { RequestOptions } from "../types.js";
import { AbortError, AgentError, MaxIterationsError } from "./errors.js";
import { dispatchHook } from "./hooks.js";
import { resolveToolSchema } from "./index.js";
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

/** Merge tracing headers from ALS context into request options. */
function withTracingHeaders(
  traceName: string,
  options?: RequestOptions,
): RequestOptions | undefined {
  const ctx = getTraceContext();
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

    const record = await executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments);

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
      try {
        response = await client.create(
          request,
          withTracingHeaders(config.traceName, options?.requestOptions),
        );
      } catch (err) {
        if (options?.signal?.aborted) throw new AbortError();
        throw new AgentError("Server call failed", err);
      }

      await dispatchHook(hooks, "onLLMResponse", { agent: config.name, iteration, response });

      addUsage(usage, response.usage);
      responseId = response.id;

      if (response.error) {
        throw new AgentError(`Server error: ${response.error.message}`);
      }

      const functionCalls = extractFunctionCalls(response.output);

      if (functionCalls.length === 0) {
        const output = parseOutput(extractText(response.output), config.outputSchema);
        const result: RunResult = {
          output,
          meta: { usage, iterations: iteration, toolCalls: allToolCalls, responseId },
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
  { response: ORResponse | undefined; functionCalls: ORFunctionCallOutputItemResponse[] }
> {
  const pendingCalls = new Map<number, PendingToolCall>();
  let completedResponse: ORResponse | undefined;

  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta":
        yield { type: "text_delta", text: event.delta };
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

  return { response: completedResponse, functionCalls };
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

      // Stream the response
      let sseStream: AsyncGenerator<ORStreamEvent, void, undefined>;
      try {
        sseStream = client.createStream(
          request,
          withTracingHeaders(config.traceName, options?.requestOptions),
        );
      } catch (err) {
        if (options?.signal?.aborted) throw new AbortError();
        throw new AgentError("Server call failed", err);
      }

      // Consume SSE events — yields text_delta events, accumulates tool calls
      const consumer = consumeStream(sseStream);
      let consumerResult: IteratorResult<
        AgentStreamEvent,
        {
          response: ORResponse | undefined;
          functionCalls: ORFunctionCallOutputItemResponse[];
        }
      >;

      // Forward all yielded events and get the return value
      while (true) {
        consumerResult = await consumer.next();
        if (consumerResult.done) break;
        yield consumerResult.value;
      }

      const { response, functionCalls } = consumerResult.value;

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
        throw new AgentError(`Server error: ${response.error.message}`);
      }

      // No function calls → done
      if (functionCalls.length === 0) {
        const output = parseOutput(
          response ? extractText(response.output) : undefined,
          config.outputSchema,
        );

        const meta = { usage, iterations: iteration, toolCalls: allToolCalls, responseId };

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

        const record = await executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments);
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

    throw new MaxIterationsError(maxIterations, undefined, allToolCalls);
  } catch (err) {
    await dispatchHook(hooks, "onAgentEnd", {
      agent: config.name,
      error: err instanceof Error ? err : new Error(String(err)),
    });
    throw err;
  }
}
