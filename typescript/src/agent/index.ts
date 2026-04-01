// =============================================================================
// Agent Layer — Public API
// =============================================================================

import { OpenResponsesClient } from "../clients/openresponses.js";
import { isStandardSchema, resolveSchema } from "../schema.js";
import { runLoop, streamLoop } from "./loop.js";
import { AgentStream } from "./stream.js";
import type {
  AgentConfig,
  AgentTool,
  Hooks,
  InferAgentOutput,
  ORInputItem,
  RunOptions,
  RunResult,
  SchemaLike,
  ToolConfig,
} from "./types.js";

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
export function tool<TInput = unknown>(config: ToolConfig<TInput>): AgentTool {
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
  readonly model?: string;
  readonly outputSchema?: S;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly maxIterations: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
  readonly parallelToolExecution: boolean;
  readonly hooks?: Hooks;

  private readonly client: OpenResponsesClient;
  private resolvedOutputSchema?: Record<string, unknown>;

  constructor(config: AgentConfig<S>) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.tools = config.tools ?? [];
    this.model = config.model;
    this.outputSchema = config.outputSchema;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.reasoningEffort = config.reasoningEffort;
    this.parallelToolExecution = config.parallelToolExecution ?? true;
    this.hooks = config.hooks;

    // Create OpenResponses client
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
    const outputSchema = await this.resolveOutputSchema();

    return runLoop(
      this.client,
      {
        name: this.name,
        instructions: this.instructions,
        tools: this.tools,
        model: this.model,
        outputSchema,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        maxIterations: this.maxIterations,
        reasoningEffort: this.reasoningEffort,
        parallelToolExecution: this.parallelToolExecution,
        hooks: this.hooks,
      },
      input,
      options,
    ) as Promise<RunResult<InferAgentOutput<S>>>;
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
    const generator = this.createStreamGenerator(input, options);
    return new AgentStream<InferAgentOutput<S>>(generator);
  }

  private async *createStreamGenerator(
    input: string | ORInputItem[],
    options?: RunOptions,
  ): AsyncGenerator<import("./types.js").AgentStreamEvent, void, undefined> {
    const outputSchema = await this.resolveOutputSchema();

    yield* streamLoop(
      this.client,
      {
        name: this.name,
        instructions: this.instructions,
        tools: this.tools,
        model: this.model,
        outputSchema,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        maxIterations: this.maxIterations,
        reasoningEffort: this.reasoningEffort,
        parallelToolExecution: this.parallelToolExecution,
        hooks: this.hooks,
      },
      input,
      options,
    );
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
// Re-exports
// ---------------------------------------------------------------------------

export { AbortError, AgentError, MaxIterationsError } from "./errors.js";
export { AgentStream } from "./stream.js";

export type {
  AgentConfig,
  AgentEndHookContext,
  AgentStartHookContext,
  AgentStreamEvent,
  AgentTool,
  AggregatedUsage,
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
  ResultEvent,
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
  ToolStartEvent,
  ToolStartHookContext,
} from "./types.js";
