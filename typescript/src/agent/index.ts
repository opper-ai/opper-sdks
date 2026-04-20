// =============================================================================
// Agent Layer — Public API
// =============================================================================

import { OpenResponsesClient } from "../clients/openresponses.js";
import { SpansClient } from "../clients/spans.js";
import { getTraceContext, runWithTraceContext } from "../context.js";
import { isStandardSchema, resolveSchema } from "../schema.js";
import type { Model } from "../types.js";
import { Conversation } from "./conversation.js";
import { runLoop, streamLoop } from "./loop.js";
import { AgentStream } from "./stream.js";
import type {
  AgentConfig,
  AgentStreamEvent,
  AgentTool,
  Hooks,
  InferAgentOutput,
  ORInputItem,
  RetryPolicy,
  RunOptions,
  RunResult,
  SchemaLike,
  ToolConfig,
  ToolProvider,
} from "./types.js";
import { isToolProvider } from "./types.js";

// ---------------------------------------------------------------------------
// tool() factory
// ---------------------------------------------------------------------------

/**
 * Define a tool for use with an Agent.
 *
 * `parameters` accepts plain JSON Schema or a Standard Schema V1 object
 * (Zod v4, Valibot, ArkType, etc.). Standard Schemas are resolved to
 * JSON Schema at tool creation time.
 *
 * @example
 * ```typescript
 * // With plain JSON Schema
 * const getMetric = tool({
 *   name: 'get_metric',
 *   description: 'Fetch a product metric by name',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       metric: { type: 'string' },
 *       period: { type: 'string', enum: ['7d', '30d', '90d'] },
 *     },
 *     required: ['metric'],
 *   },
 *   execute: async ({ metric, period }) => {
 *     return { metric, value: 42 };
 *   },
 * });
 *
 * // With Zod schema
 * import { z } from 'zod';
 * const getMetric = tool({
 *   name: 'get_metric',
 *   description: 'Fetch a product metric by name',
 *   parameters: z.object({ metric: z.string(), period: z.string().optional() }),
 *   execute: async ({ metric, period }) => {
 *     return { metric, value: 42 };
 *   },
 * });
 * ```
 */
export function tool<TParams extends SchemaLike | undefined = undefined>(
  config: ToolConfig<TParams>,
): AgentTool {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters as AgentTool["parameters"],
    timeoutMs: config.timeoutMs,
    execute: config.execute as AgentTool["execute"],
  };
}

/**
 * Resolve an AgentTool's parameters to plain JSON Schema.
 * If parameters is a Standard Schema, it is converted; otherwise passed through.
 * Returns a new AgentTool with resolved parameters (does not mutate the original).
 */
export async function resolveToolSchema(t: AgentTool): Promise<AgentTool> {
  if (!t.parameters) return t;

  if (isStandardSchema(t.parameters)) {
    const resolved = await resolveSchema(t.parameters as SchemaLike & Record<string, unknown>);
    return { ...t, parameters: resolved };
  }

  return t;
}

// ---------------------------------------------------------------------------
// Agent class
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ITERATIONS = 25;

/**
 * An agent that can run tools and interact with an LLM via the OpenResponses endpoint.
 *
 * The type parameter `S` is inferred from `outputSchema` — when you pass a
 * Standard Schema (Zod, Valibot, etc.), `result.output` is automatically typed.
 *
 * @example
 * ```typescript
 * // Untyped output (string)
 * const agent = new Agent({ name: 'bot', instructions: '...' });
 * const result = await agent.run('hello');
 * result.output; // unknown
 *
 * // Typed output via Zod schema
 * const agent = new Agent({
 *   name: 'summarizer',
 *   instructions: '...',
 *   outputSchema: z.object({ title: z.string(), points: z.array(z.string()) }),
 * });
 * const result = await agent.run('Summarize...');
 * result.output.title; // string — inferred!
 * ```
 */
export class Agent<S extends SchemaLike | undefined = undefined> {
  readonly name: string;
  readonly instructions: string;
  readonly tools: AgentTool[];
  readonly model?: Model;
  readonly outputSchema?: S;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly maxIterations: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
  readonly parallelToolExecution: boolean;
  readonly hooks?: Hooks;
  readonly traceName: string;
  readonly tracing: boolean;
  readonly retry?: RetryPolicy;
  readonly onMaxIterations?: "throw" | "return_partial";

  private readonly providers: ToolProvider[];
  private readonly client: OpenResponsesClient;
  private readonly spansClient?: SpansClient;
  private resolvedOutputSchema?: Record<string, unknown>;
  private _pendingSpanUpdates: Promise<void>[] = [];

  constructor(config: AgentConfig<S>) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.tracing = config.tracing ?? true;

    // Partition tools and providers
    const allItems = config.tools ?? [];
    const rawTools = allItems.filter((t): t is AgentTool => !isToolProvider(t));
    this.providers = allItems.filter(isToolProvider);

    this.model = config.model;
    this.outputSchema = config.outputSchema;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.reasoningEffort = config.reasoningEffort;
    this.parallelToolExecution = config.parallelToolExecution ?? true;
    this.hooks = config.hooks;
    this.traceName = config.traceName ?? config.name;
    this.retry = config.retry;
    this.onMaxIterations = config.onMaxIterations;

    // Create clients
    const apiKey =
      config.client?.apiKey ||
      (typeof process !== "undefined" ? process.env.OPPER_API_KEY : undefined);
    const baseUrl =
      config.client?.baseUrl ||
      (typeof process !== "undefined" ? process.env.OPPER_BASE_URL : undefined) ||
      "https://api.opper.ai";

    if (!apiKey) {
      throw new Error(
        "Missing API key. Pass client.apiKey in the config or set the OPPER_API_KEY environment variable.",
      );
    }

    this.client = new OpenResponsesClient({ apiKey, baseUrl });

    // Create SpansClient and wrap tools for tracing
    if (this.tracing) {
      const spansClient = new SpansClient({ apiKey, baseUrl });
      this.spansClient = spansClient;
      this.tools = rawTools.map((t) =>
        wrapToolWithTracing(t, spansClient, this._pendingSpanUpdates),
      );
    } else {
      this.tools = rawTools;
    }
  }

  /**
   * Run the agent to completion, returning the final result.
   *
   * @param input - A string prompt or an array of OpenResponses input items.
   * @param options - Per-run overrides for model, temperature, etc.
   */
  async run(
    input: string | ORInputItem[],
    options?: RunOptions,
  ): Promise<RunResult<InferAgentOutput<S>>> {
    if (!this.tracing || !this.spansClient) {
      return this.executeRun(input, options);
    }

    const parentCtx = getTraceContext();
    const explicitParentId = options?.parentSpanId;

    // Sub-agent called from a tool span — skip redundant agent span,
    // unless the caller explicitly requested a parent span (in which case
    // their intent wins).
    if (!explicitParentId && parentCtx?.isToolSpan) {
      return this.executeRun(input, options);
    }

    // Explicit parentSpanId overrides ambient trace context entirely; the
    // explicit parent may belong to a different trace, so mixing its ID with
    // ambient.traceId would produce a mismatched pair. Server fills traceId.
    const span = await this.spansClient.create({
      name: this.traceName,
      start_time: new Date().toISOString(),
      input: typeof input === "string" ? input : JSON.stringify(input),
      ...(explicitParentId
        ? { parent_id: explicitParentId }
        : parentCtx
          ? { trace_id: parentCtx.traceId, parent_id: parentCtx.spanId }
          : {}),
    });

    try {
      const traceContext = { spanId: span.id, traceId: span.trace_id };
      const result = await runWithTraceContext(traceContext, () =>
        this.executeRun(input, options, traceContext),
      );

      this._pendingSpanUpdates.push(
        this.spansClient
          .update(span.id, {
            end_time: new Date().toISOString(),
            output:
              typeof result.output === "string" ? result.output : JSON.stringify(result.output),
          })
          .catch(() => {}),
      );

      await Promise.allSettled(this._pendingSpanUpdates);
      this._pendingSpanUpdates = [];

      return result;
    } catch (error) {
      this._pendingSpanUpdates.push(
        this.spansClient
          .update(span.id, {
            end_time: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          })
          .catch(() => {}),
      );

      await Promise.allSettled(this._pendingSpanUpdates);
      this._pendingSpanUpdates = [];

      throw error;
    }
  }

  /** Internal: execute the run loop without tracing wrapper. */
  private async executeRun(
    input: string | ORInputItem[],
    options?: RunOptions,
    traceContext?: { spanId: string; traceId: string },
  ): Promise<RunResult<InferAgentOutput<S>>> {
    const providerTools = await this.activateProviders();
    try {
      const outputSchema = await this.resolveOutputSchema();
      const allTools = [...this.tools, ...providerTools];

      return (await runLoop(
        this.client,
        {
          name: this.name,
          traceName: this.traceName,
          instructions: this.instructions,
          tools: allTools,
          model: this.model,
          outputSchema,
          temperature: this.temperature,
          maxTokens: this.maxTokens,
          maxIterations: this.maxIterations,
          reasoningEffort: this.reasoningEffort,
          parallelToolExecution: this.parallelToolExecution,
          hooks: this.hooks,
          traceContext,
          retry: this.retry,
          onMaxIterations: this.onMaxIterations,
        },
        input,
        options,
      )) as RunResult<InferAgentOutput<S>>;
    } finally {
      await this.deactivateProviders();
    }
  }

  /**
   * Stream the agent's execution, yielding events as they happen.
   *
   * Returns an AgentStream that can be iterated for events and also
   * provides a `.result()` method for the final RunResult.
   *
   * @param input - A string prompt or an array of OpenResponses input items.
   * @param options - Per-run overrides for model, temperature, etc.
   */
  stream(input: string | ORInputItem[], options?: RunOptions): AgentStream<InferAgentOutput<S>> {
    if (!this.tracing || !this.spansClient) {
      return new AgentStream<InferAgentOutput<S>>(this.executeStream(input, options));
    }

    const generator = this.createTracedStreamGenerator(input, options);
    return new AgentStream<InferAgentOutput<S>>(generator);
  }

  private async *createTracedStreamGenerator(
    input: string | ORInputItem[],
    options?: RunOptions,
  ): AsyncGenerator<AgentStreamEvent, void, undefined> {
    const parentCtx = getTraceContext();
    const explicitParentId = options?.parentSpanId;

    // Sub-agent called from a tool span — skip redundant agent span,
    // but pass the parent context explicitly (ALS unreliable in generators).
    // An explicit parentSpanId opts out of this shortcut: the caller wants a
    // span under the specified parent regardless of the ambient tool-span.
    if (!explicitParentId && parentCtx?.isToolSpan) {
      yield* this.executeStream(input, options, parentCtx);
      return;
    }

    // Explicit parentSpanId overrides ambient trace context entirely; see the
    // matching comment in run() above.
    const spansClient = this.spansClient as SpansClient;
    const span = await spansClient.create({
      name: this.traceName,
      start_time: new Date().toISOString(),
      input: typeof input === "string" ? input : JSON.stringify(input),
      ...(explicitParentId
        ? { parent_id: explicitParentId }
        : parentCtx
          ? { trace_id: parentCtx.traceId, parent_id: parentCtx.spanId }
          : {}),
    });

    // Pass trace context explicitly — ALS doesn't propagate reliably through
    // async generator yield points in Node.js.
    const traceContext = { spanId: span.id, traceId: span.trace_id };

    try {
      let lastResult: RunResult<InferAgentOutput<S>> | undefined;

      for await (const event of this.executeStream(input, options, traceContext)) {
        if (event.type === "result") {
          lastResult = event as unknown as RunResult<InferAgentOutput<S>>;
        }
        yield event;
      }

      const output = lastResult?.output;
      this._pendingSpanUpdates.push(
        spansClient
          .update(span.id, {
            end_time: new Date().toISOString(),
            ...(output !== undefined
              ? { output: typeof output === "string" ? output : JSON.stringify(output) }
              : {}),
          })
          .catch(() => {}),
      );

      await Promise.allSettled(this._pendingSpanUpdates);
      this._pendingSpanUpdates = [];
    } catch (error) {
      this._pendingSpanUpdates.push(
        spansClient
          .update(span.id, {
            end_time: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          })
          .catch(() => {}),
      );

      await Promise.allSettled(this._pendingSpanUpdates);
      this._pendingSpanUpdates = [];

      throw error;
    }
  }

  /** Internal: execute the stream loop without tracing wrapper. */
  private async *executeStream(
    input: string | ORInputItem[],
    options?: RunOptions,
    traceContext?: { spanId: string; traceId: string },
  ): AsyncGenerator<AgentStreamEvent, void, undefined> {
    const providerTools = await this.activateProviders();
    try {
      const outputSchema = await this.resolveOutputSchema();
      const allTools = [...this.tools, ...providerTools];

      yield* streamLoop(
        this.client,
        {
          name: this.name,
          traceName: this.traceName,
          instructions: this.instructions,
          tools: allTools,
          model: this.model,
          outputSchema,
          temperature: this.temperature,
          maxTokens: this.maxTokens,
          maxIterations: this.maxIterations,
          reasoningEffort: this.reasoningEffort,
          parallelToolExecution: this.parallelToolExecution,
          hooks: this.hooks,
          traceContext,
          retry: this.retry,
          onMaxIterations: this.onMaxIterations,
        },
        input,
        options,
      );
    } finally {
      await this.deactivateProviders();
    }
  }

  /**
   * Create a stateful multi-turn conversation with this agent.
   *
   * The conversation tracks the full items history across `.send()` calls
   * so the agent sees prior turns as context.
   *
   * @example
   * ```typescript
   * const conv = agent.conversation();
   * await conv.send('My name is Alice.');
   * const r = await conv.send('What is my name?');
   * // Agent remembers "Alice" from the prior turn
   * ```
   */
  conversation(): Conversation<S> {
    return new Conversation<S>(this);
  }

  /**
   * Wrap this agent as a tool that another agent can call.
   *
   * The returned tool accepts a string `input` and runs this agent to completion,
   * returning an object with the agent's output and metadata (usage, iterations, tool calls).
   *
   * @example
   * ```typescript
   * const researcher = new Agent({ name: 'researcher', instructions: '...' });
   * const coordinator = new Agent({
   *   name: 'coordinator',
   *   instructions: 'Delegate research tasks to the researcher tool.',
   *   tools: [researcher.asTool({ name: 'research', description: 'Research a topic' })],
   * });
   * ```
   */
  asTool(config: { name: string; description: string }): AgentTool {
    const agentTool = tool({
      name: config.name,
      description: config.description,
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "The input prompt for the sub-agent" },
        },
        required: ["input"],
      },
      execute: async (params: unknown) => {
        const { input } = params as { input: string };
        const result = await this.run(input);
        return {
          output: result.output,
          usage: result.meta.usage,
          iterations: result.meta.iterations,
          toolCalls: result.meta.toolCalls.length,
        };
      },
    });
    agentTool._subAgent = true;
    return agentTool;
  }

  /** Activate all tool providers, returning discovered tools. */
  private async activateProviders(): Promise<AgentTool[]> {
    if (this.providers.length === 0) return [];

    const providerTools: AgentTool[] = [];
    for (const provider of this.providers) {
      try {
        const tools = await provider.setup();
        providerTools.push(...tools);
      } catch (err) {
        console.warn(
          `[Agent:${this.name}] MCP provider setup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (this.tracing && this.spansClient) {
      const sc = this.spansClient as SpansClient;
      return providerTools.map((t) => wrapToolWithTracing(t, sc, this._pendingSpanUpdates));
    }

    return providerTools;
  }

  /** Deactivate all tool providers (disconnect MCP servers, etc.). */
  private async deactivateProviders(): Promise<void> {
    if (this.providers.length === 0) return;
    await Promise.allSettled(this.providers.map((p) => p.teardown()));
  }

  /** Lazily resolve outputSchema from Standard Schema to JSON Schema. */
  private async resolveOutputSchema(): Promise<Record<string, unknown> | undefined> {
    if (!this.outputSchema) return undefined;
    if (this.resolvedOutputSchema) return this.resolvedOutputSchema;

    if (isStandardSchema(this.outputSchema)) {
      this.resolvedOutputSchema = await resolveSchema(
        this.outputSchema as SchemaLike & Record<string, unknown>,
      );
    } else {
      this.resolvedOutputSchema = this.outputSchema as Record<string, unknown>;
    }

    return this.resolvedOutputSchema;
  }
}

// ---------------------------------------------------------------------------
// Tool tracing wrapper
// ---------------------------------------------------------------------------

/** Wrap a tool's execute to create a span and set ALS context during execution. */
function wrapToolWithTracing(
  t: AgentTool,
  spansClient: SpansClient,
  pendingUpdates: Promise<void>[],
): AgentTool {
  return {
    ...t,
    execute: async (params: unknown) => {
      const traceCtx = getTraceContext();
      if (!traceCtx) return t.execute(params);

      let span: { id: string; trace_id: string };
      try {
        span = await spansClient.create({
          name: t.name,
          start_time: new Date().toISOString(),
          input: JSON.stringify(params),
          trace_id: traceCtx.traceId,
          parent_id: traceCtx.spanId,
          ...(t._subAgent
            ? { type: "SubAgent", tags: { tool: true, subagent: true } }
            : { type: "tool", tags: { tool: true } }),
        });
      } catch {
        // If span creation fails, run the tool without tracing
        return t.execute(params);
      }

      try {
        const result = await runWithTraceContext(
          { spanId: span.id, traceId: span.trace_id, isToolSpan: true },
          () => Promise.resolve(t.execute(params)),
        );

        pendingUpdates.push(
          spansClient
            .update(span.id, {
              end_time: new Date().toISOString(),
              output: JSON.stringify(result),
            })
            .catch(() => {}),
        );

        return result;
      } catch (error) {
        pendingUpdates.push(
          spansClient
            .update(span.id, {
              end_time: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error),
            })
            .catch(() => {}),
        );
        throw error;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { Conversation } from "./conversation.js";
export { AbortError, AgentError, MaxIterationsError } from "./errors.js";
export type {
  MCPServerConfig,
  MCPSSEConfig,
  MCPStdioConfig,
  MCPStreamableHTTPConfig,
} from "./mcp/index.js";
export { MCPToolProvider, mcp } from "./mcp/index.js";
export { AgentStream } from "./stream.js";
export { createToolTracingHooks, mergeHooks } from "./tracing.js";
export type {
  AgentConfig,
  AgentEndHookContext,
  AgentStartHookContext,
  AgentStreamEvent,
  AgentTool,
  AggregatedUsage,
  ErrorHookContext,
  Hooks,
  InferAgentOutput,
  IterationEndEvent,
  IterationEndHookContext,
  IterationStartEvent,
  IterationStartHookContext,
  LLMCallHookContext,
  LLMResponseHookContext,
  ORContentPart,
  ORError,
  ORFunctionCallArgsDeltaEvent,
  ORFunctionCallArgsDoneEvent,
  ORFunctionCallInputItem,
  ORFunctionCallOutputItem,
  ORFunctionCallOutputItemResponse,
  ORInputItem,
  ORMessageInputItem,
  ORMessageOutputItem,
  OROutputItem,
  OROutputTextDeltaEvent,
  OROutputTextDoneEvent,
  ORReasoning,
  ORReasoningOutputItem,
  ORRequest,
  ORResponse,
  ORResponseCompletedEvent,
  ORResponseCreatedEvent,
  ORStreamEvent,
  ORTextFormat,
  ORTool,
  ORUsage,
  ReasoningDeltaEvent,
  ResultEvent,
  RetryPolicy,
  RunMeta,
  RunOptions,
  RunResult,
  SchemaLike,
  StreamErrorEvent,
  TextDeltaEvent,
  ToolCallRecord,
  ToolConfig,
  ToolEndEvent,
  ToolEndHookContext,
  ToolProvider,
  ToolStartEvent,
  ToolStartHookContext,
} from "./types.js";
