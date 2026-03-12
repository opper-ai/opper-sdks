import { describe, expectTypeOf, it } from "vitest";
import type { InferOutput, StandardSchemaV1 } from "../schema.js";
import type {
  ContentChunk,
  DoneChunk,
  ErrorChunk,
  JsonValue,
  RunRequest,
  RunResponse,
  SchemaRunRequest,
  StreamChunk,
  ToolCallDeltaChunk,
  ToolCallStartChunk,
} from "../types.js";

describe("Type assertions (compile-time)", () => {
  it("RunResponse<T> narrows output type", () => {
    type Typed = RunResponse<{ summary: string }>;
    expectTypeOf<Typed["output"]>().toEqualTypeOf<{ summary: string }>();
  });

  it("RunResponse defaults to unknown output", () => {
    expectTypeOf<RunResponse["output"]>().toEqualTypeOf<unknown>();
  });

  it("StreamChunk narrows with type discriminant", () => {
    const chunk = {} as StreamChunk;
    if (chunk.type === "content") {
      expectTypeOf(chunk).toEqualTypeOf<ContentChunk>();
      expectTypeOf(chunk.delta).toEqualTypeOf<string>();
    }
    if (chunk.type === "tool_call_start") {
      expectTypeOf(chunk).toEqualTypeOf<ToolCallStartChunk>();
      expectTypeOf(chunk.tool_call_id).toEqualTypeOf<string>();
      expectTypeOf(chunk.tool_call_name).toEqualTypeOf<string>();
    }
    if (chunk.type === "tool_call_delta") {
      expectTypeOf(chunk).toEqualTypeOf<ToolCallDeltaChunk>();
      expectTypeOf(chunk.tool_call_args).toEqualTypeOf<string>();
    }
    if (chunk.type === "done") {
      expectTypeOf(chunk).toEqualTypeOf<DoneChunk>();
    }
    if (chunk.type === "error") {
      expectTypeOf(chunk).toEqualTypeOf<ErrorChunk>();
      expectTypeOf(chunk.error).toEqualTypeOf<string>();
    }
  });

  it("RunRequest accepts string input", () => {
    const req: RunRequest = { input: "hello" };
    expectTypeOf(req.input).toMatchTypeOf<JsonValue>();
  });

  it("RunRequest accepts object input", () => {
    const req: RunRequest = { input: { text: "hello" } };
    expectTypeOf(req.input).toMatchTypeOf<JsonValue>();
  });

  it("RunRequest allows optional schemas", () => {
    const req: RunRequest = { input: "hello" };
    expectTypeOf(req.input_schema).toEqualTypeOf<Record<string, unknown> | undefined>();
    expectTypeOf(req.output_schema).toEqualTypeOf<Record<string, unknown> | undefined>();
  });

  it("InferOutput extracts the output type from a Standard Schema", () => {
    type TestSchema = StandardSchemaV1<unknown, { name: string; age: number }>;
    type Inferred = InferOutput<TestSchema>;
    expectTypeOf<Inferred>().toEqualTypeOf<{ name: string; age: number }>();
  });

  it("SchemaRunRequest narrows output type from Standard Schema", () => {
    type Req = SchemaRunRequest<{ summary: string }>;
    type OutputSchema = Req["output"];
    // biome-ignore lint/suspicious/noExplicitAny: needed to match the schema's input type parameter
    expectTypeOf<OutputSchema>().toMatchTypeOf<StandardSchemaV1<any, { summary: string }>>();
  });

  it("JsonValue accepts all JSON primitives and nested structures", () => {
    const _string: JsonValue = "hello";
    const _number: JsonValue = 42;
    const _boolean: JsonValue = true;
    const _null: JsonValue = null;
    const _array: JsonValue = [1, "two", true, null];
    const _nested: JsonValue = { a: { b: [1, { c: "d" }] } };
    expectTypeOf(_string).toMatchTypeOf<JsonValue>();
    expectTypeOf(_number).toMatchTypeOf<JsonValue>();
    expectTypeOf(_boolean).toMatchTypeOf<JsonValue>();
    expectTypeOf(_null).toMatchTypeOf<JsonValue>();
    expectTypeOf(_array).toMatchTypeOf<JsonValue>();
    expectTypeOf(_nested).toMatchTypeOf<JsonValue>();
  });
});
