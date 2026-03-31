# Opper Python SDK

Python client for the [Opper](https://opper.ai) API.

## Install

```bash
pip install opperai
```

## Quick Start

```python
from opperai import Opper

opper = Opper()  # uses OPPER_API_KEY env var

result = opper.call("summarize", input={"text": "Long article..."})
print(result.data)

# Stream a function
for chunk in opper.stream("summarize", input={"text": "Long article..."}):
    if chunk.type == "content":
        print(chunk.delta, end="")
    if chunk.type == "complete":
        print(chunk.data)
```

## Schema Support

Pass Pydantic models, dataclasses, TypedDicts, or raw JSON Schema dicts for `input_schema` and `output_schema` — the SDK resolves them to JSON Schema automatically.

```python
from pydantic import BaseModel

class Summary(BaseModel):
    summary: str
    entities: list[str]

result = opper.call(
    "extract",
    input={"text": "Marie Curie was a physicist in Paris."},
    output_schema=Summary,
)
result.data.summary   # str — typed!
result.data.entities  # list[str]
```

Dataclasses, TypedDicts, and plain dicts also work. See [`01a_using_schemas.py`](./examples/getting-started/01a_using_schemas.py) and [`01b_using_other_schemas.py`](./examples/getting-started/01b_using_other_schemas.py).

## Observability

Use `trace()` as a decorator or context manager to group calls under a single trace span. Nesting works naturally.

```python
@opper.trace("my-pipeline")
def run():
    a = opper.call("step-1", input="hello")
    b = opper.call("step-2", input=a.data)

# or as a context manager
with opper.trace("my-pipeline") as span:
    opper.call("step-1", input="hello")
```

## Examples

| # | Example | What it shows |
|---|---|---|
| 00 | [First call](./examples/getting-started/00_your_first_call.py) | Simplest possible call |
| 01a | [Pydantic schemas](./examples/getting-started/01a_using_schemas.py) | Type-safe output with Pydantic |
| 01b | [Other schemas](./examples/getting-started/01b_using_other_schemas.py) | Dataclass, TypedDict, raw dict |
| 02 | [Streaming](./examples/getting-started/02_stream.py) | Stream deltas + complete event |
| 03a | [Tools (call)](./examples/getting-started/03a_tools_call.py) | Tool definitions with call() |
| 03b | [Tools (stream)](./examples/getting-started/03b_tools_stream.py) | Tool call chunks in streaming |
| 04a | [Generate image](./examples/getting-started/04a_generate_image.py) | Image generation |
| 04b | [Describe image](./examples/getting-started/04b_describe_image.py) | Vision / image description |
| 04c | [Edit image](./examples/getting-started/04c_edit_image.py) | Image editing |
| 05 | [Audio](./examples/getting-started/05_audio.py) | Text-to-speech + speech-to-text |
| 06 | [Video](./examples/getting-started/06_video.py) | Video generation |
| 07 | [Embeddings](./examples/getting-started/07_embeddings.py) | Vector embeddings + similarity |
| 08 | [Function mgmt](./examples/getting-started/08_function_management.py) | List, get, revisions, delete |
| 09 | [Observability](./examples/getting-started/09_observability.py) | Tracing with decorator + context manager |
| 09b | [Manual tracing](./examples/getting-started/09b_manual_tracing.py) | Manual span creation |
| 09c | [Traces](./examples/getting-started/09c_traces.py) | List, get, and inspect traces |
| 10 | [Models](./examples/getting-started/10_models.py) | List available models |
| 12 | [Knowledge base](./examples/getting-started/12_knowledge_base.py) | Semantic search with knowledge bases |
| 13 | [Web tools](./examples/getting-started/13_web_tools.py) | Web search and URL fetch (beta) |

Run a single example:

```bash
export OPPER_API_KEY="your-key"
uv run python examples/getting-started/00_your_first_call.py
```

Run all examples:

```bash
uv run python examples/run_all.py
```

## Configuration

| Parameter | Default | Env Var |
|---|---|---|
| `api_key` | — | `OPPER_API_KEY` |
| `base_url` | `https://api.opper.ai` | `OPPER_BASE_URL` |
| `headers` | `{}` | — |

## Error Handling

```python
from opperai import ApiError

try:
    opper.call("my-fn", input="hello")
except ApiError as e:
    print(e.status, e.body)
```

## Async Support

All methods have `_async` variants:

```python
result = await opper.call_async("summarize", input={"text": "..."})

async for chunk in opper.stream_async("summarize", input={"text": "..."}):
    print(chunk.delta, end="")
```

## Requirements

- Python 3.10+
- Optional: `pip install opperai[pydantic]` for Pydantic schema support

## License

MIT
