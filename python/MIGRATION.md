# Migrating to `opperai` 2.0

This guide covers the breaking changes between:

- **`opperai` 1.x** (old core SDK, Speakeasy-generated)
- **`opper-agents` 0.x** (old separate agent SDK)

and the new unified **`opperai` 2.0** in this monorepo.

If you only used `opperai` 1.x (no agents), you can skip the *Agents* section.

## TL;DR

1. `opper-agents` is gone. Agents now live inside `opperai`:
   `from opper_agents import Agent, tool` → `from opperai import Agent, tool`.
2. `Opper()` constructor arg renamed: `http_bearer=` → `api_key=`.
3. `opper.call()` takes the function name as a positional argument and returns
   a `RunResponse` with `.data` and `.meta` instead of the old
   `AppAPIPublicV2FunctionCallCallFunctionResponse` envelope.
4. `agent.process(...)` → `agent.run(...)`. Result shape is
   `{ output, meta }`, not `{ result, usage }`.
5. Pydantic is now an **optional** extra:
   `pip install 'opperai[pydantic]'` if you want Pydantic-model schemas.

## Install & imports

```diff
- pip install opperai==1.7.2
- pip install opper-agents==0.4.0
+ pip install opperai==2.0.0
```

```diff
- from opperai import Opper
- from opper_agents import Agent, tool, hook, Memory, ReactAgent, ChatAgent
+ from opperai import Opper, Agent, tool, Hooks, merge_hooks
```

## Client initialization

`http_bearer=` is gone. Use `api_key=` (or just let it pick up `OPPER_API_KEY`
from the environment, which has not changed).

```diff
- opper = Opper(http_bearer="op-...")
+ opper = Opper(api_key="op-...")
```

The old constructor parameters `url_params`, `server_idx`, `server_url`, and
`retry_config` are gone. Use `base_url=` if you need to point at a different
host; `OPPER_BASE_URL` also works.

## `opper.call()` / `opper.stream()`

### Positional function name, new response shape

```diff
- response = opper.call(
-     name="summarize",
-     instructions="Summarize the article",
-     input={"text": "..."},
-     output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
- )
- summary = response.json_payload["summary"]
+ response = opper.call(
+     "summarize",
+     instructions="Summarize the article",
+     input={"text": "..."},
+     output_schema={"type": "object", "properties": {"summary": {"type": "string"}}},
+ )
+ summary = response.data["summary"]
+ usage = response.meta.usage
```

### Removed `call()` parameters

- `examples=` — removed. Bake examples into `instructions` instead.
- `configuration=` — removed. Per-request configuration is gone.
- `tags=` — removed. Attach tags via spans (`opper.spans.create(..., tags=...)`).
- `retries=`, `server_url=`, `timeout_ms=`, `http_headers=` — removed from
  `call()`; configure once on the client.

### Streaming: direct iteration, typed chunks

```diff
- stream_response = opper.stream(name="summarize", input={"text": "..."})
- for event in stream_response.result:
-     if hasattr(event, "data") and hasattr(event.data, "delta"):
-         print(event.data.delta, end="", flush=True)
+ from opperai import ContentChunk, DoneChunk
+ for chunk in opper.stream("summarize", input={"text": "..."}):
+     if isinstance(chunk, ContentChunk):
+         print(chunk.delta, end="", flush=True)
+     elif isinstance(chunk, DoneChunk):
+         print(f"\nusage: {chunk.usage}")
```

Available chunk types are re-exported from the top level: `ContentChunk`,
`ToolCallStartChunk`, `ToolCallDeltaChunk`, `DoneChunk`, `ErrorChunk`,
`CompleteChunk`.

## Agents

### Import path change

```diff
- from opper_agents import Agent, tool, hook
- from opper_agents import AgentContext, RunResult, Memory
- from opper_agents import ReactAgent, ChatAgent
+ from opperai import Agent, tool, Hooks, merge_hooks, RunResult, RunMeta
+ # Or: from opperai.agent import Agent, tool, Hooks
```

`ReactAgent`, `ChatAgent`, and the `Memory` class have been removed. The
unified `Agent` class covers those use cases; the `Conversation` helper
(`agent.conversation()`) replaces the old memory system for multi-turn chat.

### `agent.process()` → `agent.run()`

```diff
- agent = Agent(name="assistant", instructions="Be helpful.", tools=[my_tool])
- result = await agent.process("Hello!")
- print(result.output, result.usage)
+ agent = Agent(name="assistant", instructions="Be helpful.", tools=[my_tool])
+ result = await agent.run("Hello!")
+ print(result.output, result.meta.usage, result.meta.iterations)
```

The result object is still called `RunResult`, but the usage fields moved
under `result.meta` (alongside new `iterations`, `tool_calls`, `reasoning`).

### Tools: `@tool` still works, but `@hook` is gone

The `@tool` decorator continues to extract parameters from type annotations
and docstrings. It also now accepts an explicit JSON-Schema `parameters=` if
you need full control.

Hooks are no longer decorator-based — pass a `Hooks` dataclass instead:

```diff
- from opper_agents import hook
-
- @hook("on_agent_start")
- async def on_start(context, agent):
-     print("started")
-
- @hook("on_agent_end")
- async def on_end(context, agent, result):
-     print("done")
-
- agent = Agent(..., hooks=[on_start, on_end])
+ from opperai import Hooks
+
+ hooks = Hooks(
+     on_agent_start=lambda ctx, opts: print("started"),
+     on_result=lambda ctx, opts, result: print("done"),
+ )
+ agent = Agent(..., hooks=hooks)
```

Combine multiple `Hooks` with `merge_hooks(a, b, ...)`.

### Streaming agents (new)

The old SDK had no streaming; if you want live token-by-token output, use
`agent.stream(...)`:

```python
from opperai import TextDeltaEvent, ToolStartEvent, ResultEvent

stream = agent.stream("What's the weather in Paris?")
async for event in stream:
    if isinstance(event, TextDeltaEvent):
        print(event.text, end="", flush=True)
    elif isinstance(event, ToolStartEvent):
        print(f"\n[tool] {event.tool_name}")
result = await stream.result()
```

### Removed agent features

- `enable_memory` / `Memory` — use `agent.conversation()` for multi-turn.
- `clean_tool_results` — no longer needed; tool results are aggregated in
  `result.meta.tool_calls`.
- `ReactAgent`, `ChatAgent` — use `Agent` directly.
- `@hook` decorator — use the `Hooks` dataclass.

## Functions CRUD

The Functions endpoints switched from Speakeasy-flat methods keyed by
`function_id` to **name-based** access with `run()` / `stream()`:

```diff
- func = await opper.functions.create_async(
-     name="task",
-     instructions="Do X",
-     input_schema={...},
-     model="openai/gpt-4o",
- )
- res = await opper.functions.call_async(function_id=func.id, input=data)
+ info = await opper.functions.create_async(name="task", source="...")
+ res = await opper.functions.run_async("task", {"input": data})
```

`instructions=` / `input_schema=` / `output_schema=` / `model=` /
`configuration=` on `functions.create()` are all replaced by the single
`source=` field (the function definition as code). The per-function
`revisions.*` sub-client is also gone.

## Tracing / spans

Prefer the new `opper.trace()` / `opper.trace_async()` context managers over
raw `spans.create` / `spans.update`:

```python
from opperai import Opper

opper = Opper()

async with opper.trace_async("pipeline") as span:
    r1 = await opper.call_async("step1", input="hello")
    r2 = await opper.call_async("step2", input=r1.data)
```

Nested `call`, `stream`, and `agent.run` invocations automatically pick up
the current trace context — you do not need to thread `parent_span_id`
through manually. Where you still do pass it explicitly, the parameter name
is `parent_span_id` (was already `parent_span_id` in v1, unchanged).

## Errors

```diff
- from opperai.errors import (
-     BadRequestError,
-     UnauthorizedError,         # renamed
-     NotFoundError,
-     RequestValidationError,    # removed
-     APIError,                  # renamed
- )
+ from opperai import (
+     ApiError,                  # was APIError
+     BadRequestError,
+     AuthenticationError,       # was UnauthorizedError
+     NotFoundError,
+     RateLimitError,            # new
+     InternalServerError,       # new
+ )
+ from opperai import AgentError, MaxIterationsError, AbortError  # agent-specific
```

`RequestValidationError` is gone — 422 responses now raise `BadRequestError`
with the validation details on the error body.

## Removed APIs

The following client namespaces have been **intentionally removed** from 2.0
and have no drop-in replacement yet:

- `opper.datasets.*`
- `opper.evaluations.*`
- `opper.analytics.*`
- `opper.language_models.*`
- `opper.ocr.*`
- `opper.rerank.*` (the endpoint; note that `knowledge.query(..., rerank=True)`
  still exists as a flag)
- `opper.openai.*` (OpenAI-compatibility layer)
- `opper.functions.revisions.*`

If you need these while they are reworked, call the REST API directly:

```python
import os, httpx

r = httpx.post(
    "https://api.opper.ai/v3/datasets/...",
    headers={"Authorization": f"Bearer {os.environ['OPPER_API_KEY']}"},
    json={...},
)
```

## Minimum Python version

The new SDK requires **Python ≥ 3.10** (was 3.9.2). Pydantic is an optional
extra — install with `pip install 'opperai[pydantic]'` if you want to pass
Pydantic models as `input_schema` / `output_schema`.
