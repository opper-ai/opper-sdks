# Opper SDKs

Official SDKs for the [Opper](https://opper.ai) API.

| SDK | Package | Directory |
|-----|---------|-----------|
| Python | [`opperai`](https://pypi.org/project/opperai/) | [`python/`](./python) |
| TypeScript | [`opperai`](https://www.npmjs.com/package/opperai) | [`typescript/`](./typescript) |

## Quick Start

### Python

```bash
pip install opperai
```

```python
from opperai import Opper

opper = Opper()  # uses OPPER_API_KEY env var

result = opper.call("summarize", input="Long article...")
print(result.data)
```

### TypeScript

```bash
npm install opperai
```

```typescript
import { Opper } from "opperai";

const opper = new Opper(); // uses OPPER_API_KEY env var

const result = await opper.call("summarize", {
  input: "Long article...",
});
console.log(result.data);
```

See the [Python SDK](./python) and [TypeScript SDK](./typescript) READMEs for full documentation.
