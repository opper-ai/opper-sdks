# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0b7] - 2026-04-14

### Added

- **Agent SDK** — build AI agents with tool use, streaming, structured output, and observability
- `Agent` class with `run()`, `stream()`, and `conversation()` for single-turn, streaming, and multi-turn interactions
- `@tool` decorator to define agent tools from plain Python functions (sync and async)
- `Hooks` for lifecycle events (agent start/end, iteration, tool calls, LLM calls, errors)
- `RetryPolicy` with exponential backoff for transient errors
- Structured output via Pydantic models, dataclasses, or TypedDicts
- Multi-agent composition via `agent.as_tool()` — use one agent as a tool for another
- MCP tool providers (`MCPStdioConfig`, `MCPSSEConfig`, `MCPStreamableHTTPConfig`) with lazy imports
- Automatic tracing with parent spans per `run()`/`stream()` and child spans per tool call
- `Opper.agent()` factory method for creating agents with inherited credentials
- 12 examples under `examples/agents/` including an applied daily digest agent

## [2.0.0b6] - 2026-04-10

### Added

- `ModelConfig` and `Model` types — `model` parameter now accepts a string, a `ModelConfig` dict with provider-specific `options`, or a fallback chain (list)

## [2.0.0b5] - 2026-04-01

### Changed

- Adjust schemas for forward compatibility

## [2.0.0b4] - 2026-04-01

### Added

- `aliases` field on `ModelInfo` type to match updated API spec

## [2.0.0b3] - 2026-03-31

### Added

- Runnable docs code snippets with setup/teardown markers and `run_all.py` runner

## [2.0.0b2] - 2026-03-31

### Added

- `PendingOperation` and `ArtifactStatus` types for async artifact generation
- `pending_operations` and `status` fields on `ResponseMeta`
- `ArtifactsClient` with `get_status()` for polling artifact generation status
- `generate_video()` now auto-polls pending operations and downloads the result

## [2.0.0b1] - 2026-03-30

### Changed

- New major version built for Opper API v3

[2.0.0b7]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b7
[2.0.0b6]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b6
[2.0.0b5]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b5
[2.0.0b4]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b4
[2.0.0b3]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b3
[2.0.0b2]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b2
[2.0.0b1]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b1
