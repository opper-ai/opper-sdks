# opperai

Python SDK for the Opper Task API.

## Installation

```bash
uv add opperai
```

## Quick Start

```python
from opperai import Opper

opper = Opper()  # uses OPPER_API_KEY env var

result = opper.call("summarize", input={"text": "Hello world"})
print(result.data)
```
