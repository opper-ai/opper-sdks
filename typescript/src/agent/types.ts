// =============================================================================
// Agent Layer — Type Definitions
// =============================================================================
//
// OpenResponses wire types (ORRequest, ORResponse, etc.) and agent-layer types
// (AgentConfig, AgentTool, RunResult, etc.)

import type { StandardSchemaV1 } from "../schema.js";
import type { JsonSchema, RequestOptions } from "../types.js";

// ---------------------------------------------------------------------------
// OpenResponses Wire Types — Request
// ---------------------------------------------------------------------------

/** Tool definition sent to the OpenResponses endpoint. */
export interface ORTool {
  type: "function";
  name: string;
  description?: string;
  parameters?: JsonSchema;
  strict?: boolean;
}

/** Input item sent to the server as part of the items array. */
export type ORInputItem = ORMessageInputItem | ORFunctionCallInputItem | ORFunctionCallOutputItem;

export interface ORMessageInputItem {
  type: "message";
  role: "user" | "system" | "developer";
  content: string;
}

export interface ORFunctionCallInputItem {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

export interface ORFunctionCallOutputItem {
  type: "function_call_output";
  call_id: string;
  output: string;
}

/** Text format for structured output (JSON Schema enforcement). */
export interface ORTextFormat {
  format: {
    type: "json_schema";
    name: string;
    schema: JsonSchema;
  };
}

/** Reasoning configuration. */
export interface ORReasoning {
  effort?: "low" | "medium" | "high";
  summary?: string;
}

/** Request body for POST /v3/compat/openresponses. */
export interface ORRequest {
  input: string | ORInputItem[];
  model?: string;
  instructions?: string;
  tools?: ORTool[];
  stream?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  previous_response_id?: string;
  tool_choice?: unknown;
  text?: ORTextFormat;
  reasoning?: ORReasoning;
  metadata?: Record<string, unknown>;
  store?: boolean;
  truncation?: string;
  parallel_tool_calls?: boolean;
  max_tool_calls?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  top_p?: number;
  service_tier?: string;
  include?: string[];
}

// ---------------------------------------------------------------------------
// OpenResponses Wire Types — Response
// ---------------------------------------------------------------------------

/** Output item returned from the server in the response. */
export type OROutputItem =
  | ORMessageOutputItem
  | ORFunctionCallOutputItemResponse
  | ORReasoningOutputItem;

export interface ORMessageOutputItem {
  type: "message";
  id: string;
  role: "assistant";
  status: string;
  content: ORContentPart[];
}

export interface ORContentPart {
  type: string;
  text?: string;
  annotations?: unknown[];
  refusal?: string;
}

export interface ORFunctionCallOutputItemResponse {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
  status: string;
}

export interface ORReasoningOutputItem {
  type: "reasoning";
  id: string;
  summary: Array<{ type: string; text: string }>;
  encrypted_content?: string;
}

/** Usage information from the server. */
export interface ORUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: { cached_tokens: number };
  output_tokens_details?: { reasoning_tokens: number };
}

/** Error information from the server. */
export interface ORError {
  code: string;
  message: string;
  param?: string;
  type: string;
}

/** Response from POST /v3/compat/openresponses (stream: false). */
export interface ORResponse {
  id: string;
  object: string;
  status: string;
  created_at: number;
  completed_at?: number;
  model: string;
  output: OROutputItem[];
  usage?: ORUsage;
  error?: ORError;
  instructions?: string;
  metadata?: Record<string, unknown>;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  text?: ORTextFormat;
  reasoning?: ORReasoning;
  tools?: ORTool[];
  tool_choice?: unknown;
  truncation?: string;
  service_tier?: string;
  incomplete_details?: unknown;
}

// ---------------------------------------------------------------------------
// OpenResponses Wire Types — Streaming Events
// ---------------------------------------------------------------------------

/** SSE events from the OpenResponses endpoint (stream: true). */
export type ORStreamEvent =
  | ORResponseCreatedEvent
  | ORResponseInProgressEvent
  | ORResponseCompletedEvent
  | ORResponseFailedEvent
  | ORResponseIncompleteEvent
  | OROutputItemAddedEvent
  | OROutputItemDoneEvent
  | ORContentPartAddedEvent
  | ORContentPartDoneEvent
  | OROutputTextDeltaEvent
  | OROutputTextDoneEvent
  | ORFunctionCallArgsDeltaEvent
  | ORFunctionCallArgsDoneEvent
  | ORReasoningSummaryDeltaEvent
  | ORReasoningSummaryDoneEvent
  | ORStreamErrorEvent;

export interface ORResponseCreatedEvent {
  type: "response.created";
  response: ORResponse;
}

export interface ORResponseInProgressEvent {
  type: "response.in_progress";
  response: ORResponse;
}

export interface ORResponseCompletedEvent {
  type: "response.completed";
  response: ORResponse;
}

export interface ORResponseFailedEvent {
  type: "response.failed";
  response: ORResponse;
}

export interface ORResponseIncompleteEvent {
  type: "response.incomplete";
  response: ORResponse;
}

export interface OROutputItemAddedEvent {
  type: "response.output_item.added";
  output_index: number;
  item: OROutputItem;
}

export interface OROutputItemDoneEvent {
  type: "response.output_item.done";
  output_index: number;
  item: OROutputItem;
}

export interface ORContentPartAddedEvent {
  type: "response.content_part.added";
  output_index: number;
  content_index: number;
  part: ORContentPart;
}

export interface ORContentPartDoneEvent {
  type: "response.content_part.done";
  output_index: number;
  content_index: number;
  part: ORContentPart;
}

export interface OROutputTextDeltaEvent {
  type: "response.output_text.delta";
  output_index: number;
  content_index: number;
  delta: string;
}

export interface OROutputTextDoneEvent {
  type: "response.output_text.done";
  output_index: number;
  content_index: number;
  text: string;
}

export interface ORFunctionCallArgsDeltaEvent {
  type: "response.function_call_arguments.delta";
  output_index: number;
  call_id: string;
  delta: string;
}

export interface ORFunctionCallArgsDoneEvent {
  type: "response.function_call_arguments.done";
  output_index: number;
  call_id: string;
  arguments: string;
}

export interface ORReasoningSummaryDeltaEvent {
  type: "response.reasoning_summary_text.delta";
  output_index: number;
  delta: string;
}

export interface ORReasoningSummaryDoneEvent {
  type: "response.reasoning_summary_text.done";
  output_index: number;
  text: string;
}

export interface ORStreamErrorEvent {
  type: "error";
  error: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// Agent Layer Types
// ---------------------------------------------------------------------------

/** Schema-like type: JSON Schema object or Standard Schema V1. */
export type SchemaLike = JsonSchema | StandardSchemaV1;

/** Configuration for defining a tool. */
export interface ToolConfig<TInput = unknown> {
  name: string;
  description: string;
  parameters?: SchemaLike;
  timeoutMs?: number;
  execute: (input: TInput) => unknown | Promise<unknown>;
}

/** A resolved agent tool — parameters resolved to JSON Schema. */
export interface AgentTool {
  name: string;
  description: string;
  parameters?: JsonSchema;
  timeoutMs?: number;
  execute: (input: unknown) => unknown | Promise<unknown>;
}

/** Configuration for creating an Agent — with Standard Schema output type inference. */
export interface AgentConfig<S extends SchemaLike | undefined = SchemaLike | undefined> {
  name: string;
  instructions: string;
  tools?: AgentTool[];
  model?: string;
  outputSchema?: S;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  reasoningEffort?: "low" | "medium" | "high";
  parallelToolExecution?: boolean;
  hooks?: Hooks;
  client?: { apiKey?: string; baseUrl?: string };
}

/**
 * Infer the output type from an AgentConfig's outputSchema.
 * - StandardSchemaV1 → inferred output type
 * - plain JsonSchema / undefined → unknown
 */
// biome-ignore lint/suspicious/noExplicitAny: `any` required for conditional type inference
export type InferAgentOutput<S> = S extends StandardSchemaV1<any, infer O> ? O : unknown;

// ---------------------------------------------------------------------------
// Hooks — Lifecycle Observability
// ---------------------------------------------------------------------------

/** Base context shared by all hooks. */
interface HookContextBase {
  agent: string;
}

/** Context for onAgentStart — fired before the loop begins. */
export interface AgentStartHookContext extends HookContextBase {
  input: string | ORInputItem[];
}

/** Context for onAgentEnd — fired after the loop completes (success or error). */
export interface AgentEndHookContext extends HookContextBase {
  result?: RunResult;
  error?: Error;
}

/** Context for onIterationStart — fired at the beginning of each iteration. */
export interface IterationStartHookContext extends HookContextBase {
  iteration: number;
}

/** Context for onIterationEnd — fired at the end of each iteration. */
export interface IterationEndHookContext extends HookContextBase {
  iteration: number;
  usage: AggregatedUsage;
}

/** Context for onLLMCall — fired before calling the OpenResponses endpoint. */
export interface LLMCallHookContext extends HookContextBase {
  iteration: number;
  request: ORRequest;
}

/** Context for onLLMResponse — fired after receiving the response. */
export interface LLMResponseHookContext extends HookContextBase {
  iteration: number;
  response: ORResponse;
}

/** Context for onToolStart — fired before executing a tool. */
export interface ToolStartHookContext extends HookContextBase {
  iteration: number;
  name: string;
  callId: string;
  input: unknown;
}

/** Context for onToolEnd — fired after executing a tool. */
export interface ToolEndHookContext extends HookContextBase {
  iteration: number;
  name: string;
  callId: string;
  output: unknown;
  error?: string;
  durationMs: number;
}

/** Lifecycle hooks for observing and reacting to agent execution. */
export interface Hooks {
  onAgentStart?: (ctx: AgentStartHookContext) => void | Promise<void>;
  onAgentEnd?: (ctx: AgentEndHookContext) => void | Promise<void>;
  onIterationStart?: (ctx: IterationStartHookContext) => void | Promise<void>;
  onIterationEnd?: (ctx: IterationEndHookContext) => void | Promise<void>;
  onLLMCall?: (ctx: LLMCallHookContext) => void | Promise<void>;
  onLLMResponse?: (ctx: LLMResponseHookContext) => void | Promise<void>;
  onToolStart?: (ctx: ToolStartHookContext) => void | Promise<void>;
  onToolEnd?: (ctx: ToolEndHookContext) => void | Promise<void>;
}

/** Per-run option overrides. */
export interface RunOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  reasoningEffort?: "low" | "medium" | "high";
  signal?: AbortSignal;
  parentSpanId?: string;
  requestOptions?: RequestOptions;
}

/** Record of a single tool call made during the run. */
export interface ToolCallRecord {
  name: string;
  callId: string;
  input: unknown;
  output: unknown;
  error?: string;
  durationMs: number;
}

/** The result of running an agent. */
export interface RunResult<TOutput = unknown> {
  output: TOutput;
  meta: RunMeta;
}

/** Metadata from an agent run — usage, tool calls, iteration count. */
export interface RunMeta {
  usage: AggregatedUsage;
  iterations: number;
  toolCalls: ToolCallRecord[];
  responseId?: string;
}

/** Aggregated token usage across all iterations. */
export interface AggregatedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

// ---------------------------------------------------------------------------
// Streaming — User-Facing Events
// ---------------------------------------------------------------------------

/** Events yielded by `agent.stream()`. */
export type AgentStreamEvent =
  | IterationStartEvent
  | TextDeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | IterationEndEvent
  | ResultEvent
  | StreamErrorEvent;

export interface IterationStartEvent {
  type: "iteration_start";
  iteration: number;
}

export interface TextDeltaEvent {
  type: "text_delta";
  text: string;
}

export interface ToolStartEvent {
  type: "tool_start";
  name: string;
  callId: string;
  input: unknown;
}

export interface ToolEndEvent {
  type: "tool_end";
  name: string;
  callId: string;
  output: unknown;
  error?: string;
  durationMs: number;
}

export interface IterationEndEvent {
  type: "iteration_end";
  iteration: number;
  usage?: AggregatedUsage;
}

export interface ResultEvent {
  type: "result";
  output: unknown;
  meta: RunMeta;
}

export interface StreamErrorEvent {
  type: "error";
  error: Error;
}
