# Opper SDK — Python Specification

> **Status:** Draft
> **Date:** 2026-03-25
> **Scope:** Python SDK for the Opper Task API
> **Package:** `opperai`
> **Python:** 3.10+
> **Implementation status:** Not started. Base client layer is the immediate priority. Agent layer is planned.

> **Design decision: no hints.** This SDK is deterministic. Model selection, temperature, and other generation parameters are set explicitly — not through a hints/preferences bag. The API's `hints` field is excluded from the SDK surface.

---

## 1. Design Philosophy

### Core Principle: Thin Client, Smart Server

The SDK is an **API-complete Python client with an agent-first experience**. It exposes the core Opper primitives directly, while providing a higher-level `Agent` abstraction optimized for ergonomics, composition, and production use.

For the agent layer specifically, the SDK is a **thin orchestration layer**. All LLM complexity that benefits from centralization (model selection, prompt caching, native tool formats, token-efficient output) is handled server-side by the Task API. The SDK's job is:

1. Define agents and tools with good developer experience
2. Manage the agentic loop (call -> execute tools -> call again)
3. Stream results to the user
4. Provide hooks for observability

### Two Layers, One Product

1. **Base client** — a complete, low-level Python client that maps closely to the Opper API and exposes the core primitives directly.
2. **Agent layer** — an opinionated, higher-level runtime built on top of those primitives, focused on agent ergonomics.

The base client follows the platform closely and should feel predictable and explicit. The agent layer is free to be more ergonomic and opinionated.

### Python-Specific Principles

- **Sync and async in one class.** Every method has a sync variant (`call()`) and an async variant (`call_async()`). No separate client classes.
- **Zero required dependencies.** The SDK itself depends only on `httpx`. Schema libraries (Pydantic, etc.) are detected at runtime, never required.
- **snake_case everywhere.** Method names, parameters, and fields all use snake_case — which naturally matches the API wire format.
- **Type hints throughout.** Compatible with mypy and pyright. Generic return types via `@overload`.
- **Pythonic idioms.** Decorators for tracing, context managers for scoped operations, generators for streaming. Not a TypeScript port.

---

## 2. API Design

### 2.1 Client Construction

```python
from opperai import Opper

# From environment (OPPER_API_KEY, OPPER_BASE_URL)
opper = Opper()

# Explicit
opper = Opper(api_key="op-...", base_url="https://api.opper.ai")

# With extra headers
opper = Opper(api_key="op-...", headers={"X-Custom": "value"})
```

| Parameter | Type | Default | Env Var |
|---|---|---|---|
| `api_key` | `str` | — | `OPPER_API_KEY` |
| `base_url` | `str` | `https://api.opper.ai` | `OPPER_BASE_URL` |
| `headers` | `dict[str, str]` | `{}` | — |

If `api_key` is not provided and `OPPER_API_KEY` is not set, construction raises `ValueError`.

### 2.2 Core Execution — `call()` and `stream()`

```python
from opperai import Opper
from pydantic import BaseModel

class Summary(BaseModel):
    summary: str
    confidence: float

opper = Opper()

# Typed output via Pydantic model
result = opper.call("summarize", input={"text": "..."}, output_schema=Summary)
result.data.summary      # str — typed and validated
result.data.confidence   # float

# Raw output (no schema)
result = opper.call("summarize", input={"text": "..."})
result.data  # Any

# With all options
result = opper.call(
    "summarize",
    input={"text": "..."},
    output_schema=Summary,
    input_schema={"type": "object", "properties": {"text": {"type": "string"}}},
    instructions="Be concise.",
    model="anthropic/claude-sonnet-4-6",
    temperature=0.3,
    max_tokens=500,
    reasoning_effort="high",
    parent_span_id="span-123",
    tools=[{"name": "lookup", "description": "Look up a term", "parameters": {...}}],
)

# Async variant
result = await opper.call_async("summarize", input={"text": "..."}, output_schema=Summary)
```

#### Method signature

```python
@overload
def call(self, name: str, *, output_schema: type[T], **kwargs) -> RunResponse[T]: ...
@overload
def call(self, name: str, **kwargs) -> RunResponse[Any]: ...

def call(
    self,
    name: str,
    *,
    input: Any,
    input_schema: SchemaLike | None = None,
    output_schema: SchemaLike | None = None,
    instructions: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    reasoning_effort: str | None = None,
    parent_span_id: str | None = None,
    tools: list[ToolDef] | None = None,
    request_options: RequestOptions | None = None,
) -> RunResponse[Any]:
    ...
```

**Pythonic differences from TypeScript:**
- Parameters are keyword arguments, not a request dict. `opper.call("name", input=..., output_schema=...)` is more natural in Python.
- When a Pydantic `BaseModel` subclass is passed as `output_schema`, the response `data` is an instance of that model (parsed via `model_validate()`), not a raw dict.
- `call_async()` is the async variant — same signature, returns an awaitable.

### 2.3 Schema Support

JSON Schema is the wire format. The SDK detects and converts schema types at runtime:

| Input | Detection | Conversion | Response `data` type |
|---|---|---|---|
| `type[BaseModel]` | `hasattr(cls, 'model_json_schema')` | `cls.model_json_schema()` | Instance of the model |
| `type[dataclass]` | `dataclasses.is_dataclass(cls)` | Inspect fields, build JSON Schema | Instance of the dataclass |
| `type[TypedDict]` | `is_typeddict(cls)` | Inspect annotations | `dict` |
| `dict` | `isinstance(obj, dict)` | Pass through as raw JSON Schema | `dict` or raw value |
| `None` | — | No schema sent | `Any` |

```python
from pydantic import BaseModel
from dataclasses import dataclass

# Pydantic — full type inference and validation
class Sentiment(BaseModel):
    label: str
    score: float

result = opper.call("analyze", input="Great product!", output_schema=Sentiment)
result.data.label  # str
result.data.score  # float

# Dataclass — lightweight alternative
@dataclass
class Sentiment:
    label: str
    score: float

result = opper.call("analyze", input="Great product!", output_schema=Sentiment)
result.data.label  # str

# Raw JSON Schema — when you don't need a class
result = opper.call("analyze", input="Great product!", output_schema={
    "type": "object",
    "properties": {
        "label": {"type": "string"},
        "score": {"type": "number"},
    },
})
result.data["label"]  # dict access
```

**Zero Pydantic dependency.** The SDK detects Pydantic at runtime. If Pydantic is not installed, passing a `BaseModel` subclass raises a helpful error. Raw dicts and dataclasses always work.

### 2.4 Streaming

```python
# Sync streaming — returns Iterator[StreamChunk]
for chunk in opper.stream("summarize", input={"text": "..."}):
    match chunk.type:
        case "content":
            print(chunk.delta, end="", flush=True)
        case "complete":
            print(chunk.data)
        case "done":
            print(chunk.usage)

# Async streaming — returns AsyncIterator[StreamChunk]
async for chunk in opper.stream_async("summarize", input={"text": "..."}):
    match chunk.type:
        case "content":
            print(chunk.delta, end="", flush=True)
```

`stream()` accepts the same keyword arguments as `call()`. It returns an `Iterator[StreamChunk]`. `stream_async()` returns an `AsyncIterator[StreamChunk]`.

#### With typed output schema

```python
for chunk in opper.stream("summarize", input={"text": "..."}, output_schema=Summary):
    match chunk.type:
        case "content":
            print(chunk.delta, end="", flush=True)
        case "complete":
            print(chunk.data.summary)  # typed — Summary instance
```

### 2.5 Tracing

Two Pythonic patterns for automatic trace context propagation, both using `contextvars`:

#### Decorator pattern (recommended)

```python
@opper.trace("my-pipeline")
def my_pipeline():
    r1 = opper.call("step1", input="hello")
    r2 = opper.call("step2", input=r1.data)
    return r2

result = my_pipeline()
# Both step1 and step2 are automatically linked to the 'my-pipeline' span
```

#### Context manager pattern (when you need the span handle)

```python
with opper.trace("my-pipeline") as span:
    print(f"trace: {span.trace_id}, span: {span.id}")
    r1 = opper.call("step1", input="hello")
    r2 = opper.call("step2", input=r1.data)
```

#### With options

```python
@opper.trace(name="my-pipeline", input="processing batch", meta={"env": "prod"}, tags={"team": "ml"})
def my_pipeline():
    ...
```

#### Async tracing

```python
@opper.trace_async("my-pipeline")
async def my_pipeline():
    r1 = await opper.call_async("step1", input="hello")
    r2 = await opper.call_async("step2", input=r1.data)
    return r2

# Context manager
async with opper.trace_async("my-pipeline") as span:
    r1 = await opper.call_async("step1", input="hello")
```

#### Nesting

Nesting works naturally — inner traces become child spans:

```python
@opper.trace("outer")
def outer():
    inner()  # inner's span becomes child of outer's

@opper.trace("inner")
def inner():
    opper.call("step", input="...")  # inherits inner's span
```

#### How it works

`trace()` returns a `Trace` object that implements both `__call__` (decorator) and `__enter__`/`__exit__` (context manager). Internally:

1. Creates a span via `opper.spans.create()`
2. Sets a `ContextVar[TraceContext]` with the span ID and trace ID
3. All `call()` and `stream()` invocations check the `ContextVar` and include `parent_span_id` automatically
4. On exit (or function return), updates the span with output/error and end time

### 2.6 Tools as Data

In the base client layer, tools are **data** — plain dicts or dataclasses passed to `call()`. The server handles tool calls; the SDK does not execute tools locally.

```python
# Tools as dicts
result = opper.call(
    "assistant",
    input="What's the weather in Paris?",
    tools=[
        {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                },
                "required": ["city"],
            },
        }
    ],
)

# Tools with Pydantic schema for parameters
from pydantic import BaseModel, Field

class WeatherParams(BaseModel):
    city: str = Field(description="City name")
    units: str = Field(default="celsius", description="Temperature units")

result = opper.call(
    "assistant",
    input="What's the weather in Paris?",
    tools=[
        {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": WeatherParams,  # SDK converts to JSON Schema
        }
    ],
)
```

> **Note:** The `@tool` decorator (with local `execute` function) is part of the **agent layer** (Section 5), where the SDK runs an agentic loop and executes tools locally. In the base client, tools are just definitions sent to the server.

### 2.7 Sub-Clients

The `Opper` class exposes sub-clients for all API areas:

| Sub-client | Access | Description |
|---|---|---|
| `functions` | `opper.functions` | Function CRUD, execution, examples, revisions, realtime |
| `spans` | `opper.spans` | Create/update/get/delete trace spans |
| `traces` | `opper.traces` | List/get/delete traces |
| `generations` | `opper.generations` | List/get/delete recorded generations |
| `models` | `opper.models` | List available models (with filtering) |
| `embeddings` | `opper.embeddings` | OpenAI-compatible embeddings |
| `knowledge` | `opper.knowledge` | Knowledge base v2 API (CRUD, search, files) |
| `beta.web` | `opper.beta.web` | Web fetch/search (beta) |
| `system` | `opper.system` | Health checks |

Every sub-client method has both sync and async variants (`method()` / `method_async()`).

#### FunctionsClient

```python
# List / Get / Update / Delete
functions = opper.functions.list()
fn = opper.functions.get("my-function")
opper.functions.update("my-function", source="...")
opper.functions.delete("my-function")

# Direct execution (low-level — prefer opper.call() / opper.stream())
result = opper.functions.run("my-function", request={...})
stream = opper.functions.stream("my-function", request={...})

# Realtime voice agents
opper.functions.create_realtime("voice-agent", instructions="...", model="...", voice="...")
ws_url = opper.functions.get_realtime_ws_url("voice-agent")

# Revisions
revisions = opper.functions.list_revisions("my-function")
revision = opper.functions.get_revision("my-function", revision_id=3)
opper.functions.revert_revision("my-function", revision_id=3)

# Examples (few-shot steering)
opper.functions.create_example("my-function", input={...}, output={...}, tag="golden")
opper.functions.create_examples_batch("my-function", examples=[...])
examples = opper.functions.list_examples("my-function", limit=50, tag="golden")
opper.functions.delete_example("my-function", uuid="...")
```

#### SpansClient

```python
span = opper.spans.create(name="my-span", input="...", meta={"key": "value"})
# span.id, span.trace_id

opper.spans.update(span.id, output="result", end_time="2026-03-25T12:00:00Z")
span_data = opper.spans.get(span.id)
opper.spans.delete(span.id)
```

#### TracesClient

```python
traces = opper.traces.list(limit=10, name="my-pipeline")
# traces.data, traces.meta.total_count

trace = opper.traces.get(trace_id)
# trace.spans — all spans in the trace

opper.traces.delete(trace_id)
```

#### GenerationsClient

```python
generations = opper.generations.list(query="sentiment", page=1, page_size=20)
generation = opper.generations.get(generation_id)
opper.generations.delete(generation_id)
```

#### ModelsClient

```python
models = opper.models.list(
    type="llm",
    provider="anthropic",
    capability="tools",
    limit=20,
)
```

#### EmbeddingsClient

```python
result = opper.embeddings.create(
    input="Hello world",
    model="openai/text-embedding-3-small",
    dimensions=256,
)
# result.data[0].embedding — list[float]
```

#### KnowledgeClient

```python
# Knowledge base management
kb = opper.knowledge.create(name="docs", embedding_model="openai/text-embedding-3-small")
kbs = opper.knowledge.list()
kb = opper.knowledge.get(kb.id)
kb = opper.knowledge.get_by_name("docs")
opper.knowledge.delete(kb.id)

# Documents
doc = opper.knowledge.add(kb.id, content="Document text...", key="doc-1", metadata={"source": "wiki"})
results = opper.knowledge.query(kb.id, query="How does auth work?", top_k=5, rerank=True)
doc = opper.knowledge.get_document(kb.id, key="doc-1")
opper.knowledge.delete_documents(kb.id, filters=[{"field": "source", "operation": "=", "value": "wiki"}])

# File operations
opper.knowledge.upload_file(kb.id, file=open("guide.pdf", "rb"), filename="guide.pdf", chunk_size=1000)
files = opper.knowledge.list_files(kb.id)
url = opper.knowledge.get_download_url(kb.id, file_id="...")
opper.knowledge.delete_file(kb.id, file_id="...")

# Pre-signed upload (for large files)
upload = opper.knowledge.get_upload_url(kb.id, filename="large.pdf")
# ... upload to upload.url ...
opper.knowledge.register_file(kb.id, filename="large.pdf", file_id=upload.file_id, content_type="application/pdf")
```

#### WebToolsClient (Beta)

```python
# Fetch URL as markdown
page = opper.beta.web.fetch(url="https://example.com")
print(page.content)

# Web search
results = opper.beta.web.search(query="Python SDK best practices")
for r in results.results:
    print(r.title, r.url, r.snippet)
```

#### SystemClient

```python
health = opper.system.health()
# health.status == "ok"
```

### 2.8 Media Convenience Methods

High-level methods for media generation, built on top of `call()`:

```python
# Image generation
result = opper.generate_image(prompt="A sunset over a calm ocean", model="openai/dall-e-3", size="1792x1024")
result.save("./sunset")  # -> "./sunset.jpeg" (extension auto-detected)

# With named function (for caching)
result = opper.generate_image("hero-image", prompt="Product photo", quality="hd")

# Image editing with reference
result = opper.generate_image(
    prompt="Add a rainbow",
    reference_image="./photo.jpg",  # str path, bytes, or Path
)

# Video generation
result = opper.generate_video(prompt="A cat walking down a city street", aspect_ratio="16:9")
result.save("./cat")  # -> "./cat.mp4"

# Text to speech
result = opper.text_to_speech(text="Hello! Welcome to our platform.", voice="alloy")
result.save("./welcome.mp3")

# Transcription (speech to text)
result = opper.transcribe(audio="./meeting.mp3", language="en")
print(result.data.text)
```

All media methods have async variants: `generate_image_async()`, `generate_video_async()`, `text_to_speech_async()`, `transcribe_async()`.

`MediaResponse` extends `RunResponse` with a `save(path: str | Path) -> Path` method that writes the content to disk and returns the final path (with auto-detected extension).

Media inputs (`reference_image`, `audio`, `source_image`, etc.) accept `str` (file path), `bytes`, or `pathlib.Path`.

### 2.9 Error Handling

```python
from opperai import ApiError

try:
    result = opper.call("nonexistent", input="hello")
except ApiError as e:
    print(e.status)       # 404
    print(e.status_text)  # "Not Found"
    print(e.body)         # {"error": {"code": "not_found", "message": "..."}}
```

`ApiError` inherits from `Exception`:

```python
class ApiError(Exception):
    status: int
    status_text: str
    body: Any
```

Raised for any non-2xx HTTP response.

### 2.10 Request Options

Every method accepts an optional `request_options` parameter:

```python
from opperai import RequestOptions

result = opper.call(
    "summarize",
    input={"text": "..."},
    request_options=RequestOptions(
        timeout=30.0,
        headers={"X-Request-Id": "abc-123"},
    ),
)
```

```python
@dataclass
class RequestOptions:
    headers: dict[str, str] | None = None
    timeout: float | None = None  # seconds
```

---

## 3. Types

All SDK types use `@dataclass(frozen=True)` for immutable value objects. No Pydantic dependency for internal types.

### 3.1 Response Types

```python
@dataclass(frozen=True)
class RunResponse(Generic[T]):
    data: T
    meta: ResponseMeta | None = None

@dataclass(frozen=True)
class ResponseMeta:
    function_name: str
    script_cached: bool
    execution_ms: int
    llm_calls: int
    tts_calls: int
    image_gen_calls: int
    generation_ms: int | None = None
    cost: float | None = None
    usage: UsageInfo | None = None
    models_used: list[str] | None = None
    model_warnings: list[str] | None = None
    guards: list[Any] | None = None
    message: str | None = None

@dataclass(frozen=True)
class UsageInfo:
    input_tokens: int
    output_tokens: int
    reasoning_tokens: int | None = None
    cache_read_tokens: int | None = None
    cache_creation_tokens: int | None = None
    cache_creation_1h_tokens: int | None = None
    input_audio_tokens: int | None = None
    output_audio_tokens: int | None = None
```

### 3.2 Stream Chunk Types

```python
@dataclass(frozen=True)
class ContentChunk:
    type: Literal["content"]
    delta: str

@dataclass(frozen=True)
class ToolCallStartChunk:
    type: Literal["tool_call_start"]
    tool_call_index: int
    tool_call_id: str
    tool_call_name: str

@dataclass(frozen=True)
class ToolCallDeltaChunk:
    type: Literal["tool_call_delta"]
    tool_call_index: int
    tool_call_args: str

@dataclass(frozen=True)
class DoneChunk:
    type: Literal["done"]
    usage: UsageInfo | None = None

@dataclass(frozen=True)
class ErrorChunk:
    type: Literal["error"]
    error: str

@dataclass(frozen=True)
class CompleteChunk(Generic[T]):
    type: Literal["complete"]
    data: T
    meta: ResponseMeta | None = None

StreamChunk = ContentChunk | ToolCallStartChunk | ToolCallDeltaChunk | DoneChunk | ErrorChunk | CompleteChunk
```

### 3.3 Tracing Types

```python
@dataclass(frozen=True)
class SpanHandle:
    id: str
    trace_id: str

@dataclass(frozen=True)
class CreateSpanRequest:
    name: str
    trace_id: str | None = None
    parent_id: str | None = None
    type: str | None = None
    input: str | None = None
    output: str | None = None
    error: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    meta: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    tags: dict[str, Any] | None = None

@dataclass(frozen=True)
class CreateSpanResponse:
    id: str
    trace_id: str
    name: str
    parent_id: str | None = None
    type: str | None = None
```

### 3.4 Tool Definition (Data)

```python
ToolDef = TypedDict("ToolDef", {
    "name": str,
    "description": NotRequired[str],
    "parameters": NotRequired[dict[str, Any] | type],  # JSON Schema dict or Pydantic model class
})
```

### 3.5 Knowledge Base Types

```python
@dataclass(frozen=True)
class KnowledgeBaseInfo:
    id: str
    name: str
    created_at: str
    embedding_model: str

@dataclass(frozen=True)
class QueryResult:
    id: str
    key: str
    content: str
    metadata: dict[str, Any]
    score: float

@dataclass(frozen=True)
class KnowledgeBaseFilter:
    field: str
    operation: str  # "=", "!=", ">", "<", "in"
    value: str | int | float | list[str | int | float]
```

### 3.6 Media Types

```python
@dataclass(frozen=True)
class MediaResponse(RunResponse[T]):
    def save(self, path: str | Path) -> Path:
        """Write media content to disk. Returns final path with auto-detected extension."""
        ...

@dataclass(frozen=True)
class GeneratedImage:
    url: str | None = None
    base64: str | None = None
    mime_type: str | None = None

@dataclass(frozen=True)
class GeneratedVideo:
    url: str | None = None
    base64: str | None = None
    mime_type: str | None = None

@dataclass(frozen=True)
class GeneratedSpeech:
    audio: str | None = None  # base64
    mime_type: str | None = None

@dataclass(frozen=True)
class Transcription:
    text: str
```

---

## 4. Base Client Internals

### 4.1 HTTP Transport

The SDK uses `httpx` for both sync and async HTTP:

```python
class BaseClient:
    def __init__(self, api_key: str, base_url: str, headers: dict[str, str]):
        self._sync_client = httpx.Client(...)
        self._async_client = httpx.AsyncClient(...)

    def _get(self, path: str, **kwargs) -> Any: ...
    async def _get_async(self, path: str, **kwargs) -> Any: ...

    def _post(self, path: str, body: Any = None, **kwargs) -> Any: ...
    async def _post_async(self, path: str, body: Any = None, **kwargs) -> Any: ...

    def _put(self, path: str, body: Any = None, **kwargs) -> Any: ...
    def _patch(self, path: str, body: Any = None, **kwargs) -> Any: ...
    def _delete(self, path: str, **kwargs) -> Any: ...

    def _stream(self, path: str, body: Any = None, **kwargs) -> Iterator[StreamChunk]: ...
    async def _stream_async(self, path: str, body: Any = None, **kwargs) -> AsyncIterator[StreamChunk]: ...
```

### 4.2 Authentication

All requests (except `/health` and `/v3/models`) include:
```
Authorization: Bearer <api_key>
```

### 4.3 SSE Parsing

The `_stream()` / `_stream_async()` methods:

1. Send a POST request with `Accept: text/event-stream`
2. Read the response body line by line
3. Track current event type from `event:` lines
4. For each `data: ` line:
   - If remainder is `[DONE]`, close the iterator
   - If event type is `complete`, parse as `CompleteChunk`
   - Otherwise, parse as the appropriate `StreamChunk` variant based on `type` field
5. Yield frozen dataclass instances

### 4.4 Schema Resolution

Before sending to the API, the SDK resolves schema objects:

```python
def resolve_schema(schema: SchemaLike | None) -> dict | None:
    if schema is None:
        return None
    if isinstance(schema, dict):
        return schema
    if hasattr(schema, "model_json_schema"):  # Pydantic BaseModel
        return schema.model_json_schema()
    if dataclasses.is_dataclass(schema):
        return _dataclass_to_json_schema(schema)
    if is_typeddict(schema):
        return _typeddict_to_json_schema(schema)
    raise TypeError(f"Unsupported schema type: {type(schema)}")
```

### 4.5 Trace Context Propagation

```python
from contextvars import ContextVar

_trace_context: ContextVar[TraceContext | None] = ContextVar("_trace_context", default=None)

@dataclass(frozen=True)
class TraceContext:
    span_id: str
    trace_id: str
```

When `call()` or `stream()` is invoked, they check `_trace_context.get()`. If a context exists and no explicit `parent_span_id` was passed, the context's `span_id` is used automatically.

---

## 5. Agent Layer (Planned)

> **Not yet implemented.** This section describes the planned agent layer.

### 5.1 Defining an Agent

```python
from opperai import Agent

agent = Agent(
    name="analytics-assistant",
    instructions="You help users understand their product metrics.",
    tools=[get_activation_rate, query_database],

    # Optional
    model="anthropic/claude-sonnet-4-6",
    input_schema=QuestionSchema,
    output_schema=AnswerSchema,
    temperature=0.7,
    max_tokens=4096,
    max_iterations=10,
    hooks={"on_tool_start": my_hook, "on_tool_end": my_hook},
)
```

### 5.2 Tool Definition with `@tool` Decorator

In the agent layer, tools are executable. The `@tool` decorator extracts metadata from the function:

```python
from opperai import tool

@tool
def get_metric(metric: str, period: str = "30d") -> dict:
    """Fetch a product metric by name."""
    return {"metric": metric, "value": 42}

# With explicit description
@tool(description="Fetch a product metric by name")
def get_metric(metric: str, period: str = "30d") -> dict:
    return {"metric": metric, "value": 42}

# With Pydantic parameters for richer schemas
@tool(parameters=MetricParams)
def get_metric(metric: str, period: str = "30d") -> dict:
    ...
```

The decorator:
1. Extracts `name` from the function name
2. Extracts `description` from the `description` kwarg or the docstring
3. Extracts `parameters` JSON Schema from type annotations, or from an explicit Pydantic model
4. Wraps the function so it is still callable normally, but also carries `.name`, `.description`, `.parameters` attributes
5. Supports both sync and async functions

Type-to-JSON-Schema mapping:
- `str` -> `{"type": "string"}`
- `int` -> `{"type": "integer"}`
- `float` -> `{"type": "number"}`
- `bool` -> `{"type": "boolean"}`
- `list[X]` -> `{"type": "array", "items": ...}`
- `dict` -> `{"type": "object"}`
- `X | None` -> not required
- Parameters with defaults -> not required

### 5.3 Running an Agent

```python
# Run — get the final result
result = agent.run("What is our activation rate?")
print(result.output)
print(result.usage)

# Stream — observe events
for event in agent.stream("What is our activation rate?"):
    match event.type:
        case "text_delta":
            print(event.text, end="")
        case "tool_start":
            print(f"Calling {event.tool_name}...")
        case "tool_end":
            print(f"{event.tool_name} returned: {event.result}")

# Stream with final result
stream = agent.stream("What is our activation rate?")
for event in stream:
    ...
result = stream.result()  # already resolved

# Async variants
result = await agent.run_async("What is our activation rate?")
async for event in agent.stream_async("What is our activation rate?"):
    ...
```

#### Per-run overrides

```python
result = agent.run(
    "What is our activation rate?",
    model="anthropic/claude-sonnet-4-6",
    temperature=0.2,
    max_iterations=5,
    parent_span_id="span-123",
)
```

#### RunResult

```python
@dataclass(frozen=True)
class RunResult(Generic[T]):
    output: T
    usage: UsageInfo
    iterations: int
    tool_calls: list[ToolCallRecord]
    meta: ResponseMeta
```

### 5.4 Multi-Agent Composition

```python
researcher = Agent(name="researcher", instructions="...", tools=[web_search])
writer = Agent(
    name="writer",
    instructions="You write clear, concise reports.",
    tools=[researcher.as_tool("research", "Research a topic and return findings")],
)

result = writer.run("Write a report on AI agent frameworks")
```

### 5.5 Hooks

```python
agent = Agent(
    name="my-agent",
    instructions="...",
    tools=[...],
    hooks={
        "on_agent_start":     lambda input, context: ...,
        "on_agent_end":       lambda output, usage, error, context: ...,
        "on_iteration_start": lambda iteration, context: ...,
        "on_iteration_end":   lambda iteration, usage, context: ...,
        "on_tool_start":      lambda tool_name, input, context: ...,
        "on_tool_end":        lambda tool_name, result, error, duration, context: ...,
        "on_llm_call":        lambda iteration, context: ...,
        "on_llm_response":    lambda iteration, usage, has_tool_calls, context: ...,
        "on_text_delta":      lambda text, context: ...,
    },
)
```

Hooks are sync or async. The SDK awaits async hooks. Every hook receives a mutable `context` dict for tracking custom state.

### 5.6 MCP Integration

```python
from opperai import mcp

agent = Agent(
    name="file-assistant",
    instructions="Help users manage files.",
    tools=[
        mcp(command="uvx", args=["mcp-server-filesystem", "/tmp"]),
    ],
)
```

Supports stdio, SSE, and HTTP transports.

---

## 6. Recommended Project Structure

```
python/
  SPEC.md
  pyproject.toml
  src/opperai/
    __init__.py              # Opper, tool, mcp, ApiError re-exports
    _client.py               # Opper class (call, stream, trace, media, sub-clients)
    _base_client.py          # BaseClient (HTTP layer, SSE parsing)
    _context.py              # contextvars trace context
    _schema.py               # Schema detection/conversion
    _trace.py                # Trace decorator/context manager
    _media.py                # Media convenience methods
    types.py                 # All public type definitions
    clients/
      __init__.py
      functions.py           # FunctionsClient
      spans.py               # SpansClient
      traces.py              # TracesClient
      generations.py         # GenerationsClient
      models.py              # ModelsClient
      embeddings.py          # EmbeddingsClient
      knowledge.py           # KnowledgeClient
      web_tools.py           # WebToolsClient (beta)
      system.py              # SystemClient
```
