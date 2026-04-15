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

## Agent SDK

Build AI agents with tool use, streaming, multi-agent composition, and MCP integration.

### Python

```python
from opperai import Agent, tool

@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    return f"Sunny, 22°C in {city}"

agent = Agent(
    name="weather-assistant",
    instructions="You are a helpful weather assistant.",
    tools=[get_weather],
)

result = await agent.run("What's the weather in Paris?")
print(result.output)
```

See the [Python agent examples](./python/examples/agents/) for streaming, hooks, MCP integration, and multi-agent patterns.

### TypeScript

```typescript
import { z } from "zod";
import { Agent, tool } from "opperai";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => `Sunny, 22°C in ${city}`,
});

const agent = new Agent({
  name: "weather-assistant",
  instructions: "You are a helpful weather assistant.",
  tools: [getWeather],
});

const result = await agent.run("What's the weather in Paris?");
console.log(result.output);
```

See the [TypeScript agent examples](./typescript/examples/agents/) for streaming, hooks, MCP integration, and multi-agent patterns.

---

See the [Python SDK](./python) and [TypeScript SDK](./typescript) READMEs for full documentation.
