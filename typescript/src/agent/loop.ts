// =============================================================================
// Agent Layer — Agentic Loop
// =============================================================================

import type { OpenResponsesClient } from "../clients/openresponses.js";
import { AgentError, MaxIterationsError, AbortError } from "./errors.js";
import { resolveToolSchema } from "./index.js";
import type {
  AgentTool,
  AggregatedUsage,
  ORFunctionCallOutputItemResponse,
  ORInputItem,
  OROutputItem,
  ORRequest,
  ORResponse,
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
  instructions: string;
  tools: AgentTool[];
  model?: string;
  outputSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  maxIterations: number;
  reasoningEffort?: "low" | "medium" | "high";
  parallelToolExecution: boolean;
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
    agg.reasoningTokens =
      (agg.reasoningTokens ?? 0) + usage.output_tokens_details.reasoning_tokens;
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
  // Resolve tool schemas (Standard Schema → JSON Schema)
  const resolvedTools = await Promise.all(config.tools.map(resolveToolSchema));
  const orTools = resolvedTools.map(toORTool);

  // Build items array — full conversation history, accumulated across iterations
  const items: ORInputItem[] =
    typeof input === "string"
      ? [{ type: "message", role: "user", content: input }]
      : [...input];

  const usage: AggregatedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  const allToolCalls: ToolCallRecord[] = [];
  const maxIterations = options?.maxIterations ?? config.maxIterations;
  let lastOutput: unknown;
  let responseId: string | undefined;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    // Check abort
    if (options?.signal?.aborted) {
      throw new AbortError();
    }

    // Build request
    const request: ORRequest = {
      input: items,
      instructions: config.instructions,
      ...(orTools.length > 0 ? { tools: orTools } : {}),
      ...(options?.model ?? config.model ? { model: options?.model ?? config.model } : {}),
      ...(options?.temperature ?? config.temperature
        ? { temperature: options?.temperature ?? config.temperature }
        : {}),
      ...(options?.maxTokens ?? config.maxTokens
        ? { max_output_tokens: options?.maxTokens ?? config.maxTokens }
        : {}),
      ...(options?.reasoningEffort ?? config.reasoningEffort
        ? { reasoning: { effort: options?.reasoningEffort ?? config.reasoningEffort } }
        : {}),
      ...(config.outputSchema
        ? { text: { format: { type: "json_schema", name: "output", schema: config.outputSchema } } }
        : {}),
    };

    // Call server
    let response: ORResponse;
    try {
      response = await client.create(request, options?.requestOptions);
    } catch (err) {
      if (options?.signal?.aborted) throw new AbortError();
      throw new AgentError("Server call failed", err);
    }

    // Track usage and response ID
    addUsage(usage, response.usage);
    responseId = response.id;

    // Check for server error
    if (response.error) {
      throw new AgentError(`Server error: ${response.error.message}`);
    }

    // Extract function calls from response
    const functionCalls = extractFunctionCalls(response.output);

    // No function calls → done
    if (functionCalls.length === 0) {
      const text = extractText(response.output);
      let output: unknown = text;

      // Try to parse structured output
      if (config.outputSchema && text) {
        try {
          output = JSON.parse(text);
        } catch {
          // Leave as string if JSON parsing fails
        }
      }

      return {
        output,
        meta: {
          usage,
          iterations: iteration,
          toolCalls: allToolCalls,
          responseId,
        },
      };
    }

    // Execute tools
    const toolRecords: ToolCallRecord[] = [];

    if (config.parallelToolExecution) {
      const results = await Promise.all(
        functionCalls.map((fc) => executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments)),
      );
      toolRecords.push(...results);
    } else {
      for (const fc of functionCalls) {
        const record = await executeTool(resolvedTools, fc.call_id, fc.name, fc.arguments);
        toolRecords.push(record);
      }
    }

    allToolCalls.push(...toolRecords);

    // Accumulate into items: all function_call items first (the assistant's
    // tool calls), then all function_call_output items (our results).
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

    // Track last output for MaxIterationsError
    lastOutput = extractText(response.output);
  }

  // Max iterations reached
  throw new MaxIterationsError(maxIterations, lastOutput, allToolCalls);
}
