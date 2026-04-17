# Opper SDKs

Monorepo containing the Python and TypeScript SDKs for the Opper API v3.

## OpenAPI Spec Workflow

1. Run `bash scripts/pull-openapi.sh` to fetch the latest spec from `api.opper.ai`
2. Review the diff output — irrelevant compat schemas are filtered via `scripts/openapi-ignore.yaml`
3. Update SDK types and clients to match relevant spec changes
4. Run all checks (see below), then update changelogs and bump versions

## Checks

### TypeScript (`typescript/`)

```bash
npm run lint      # biome check
npm run build     # tsc (type checking)
npm test          # vitest
```

Use `npm run check` to auto-fix lint issues (import ordering, formatting).

### Python (`python/`)

```bash
uv run ruff check src/           # lint
uv run pyright src/               # type check
PYTHONPATH=src uv run pytest tests/  # unit tests
```

Note: `PYTHONPATH=src` is needed for pytest to find the local source.

## Docs Code Snippets

Each SDK has a `docs_code_snippets/` directory containing minimal, per-endpoint code examples used by the [docs site](https://github.com/opper-ai/mintlify-docs). These are fetched from GitHub at docs build time and injected into the v3 API reference as `x-codeSamples`.

- **Python**: `python/docs_code_snippets/` — one `.py` file per endpoint
- **TypeScript**: `typescript/docs_code_snippets/` — one `.ts` file per endpoint

When SDK APIs change, update the corresponding snippet files here. The docs repo's `example-map.yaml` controls which snippets map to which endpoints.

## Beta Endpoints

When an OpenAPI operation is tagged `x-beta: true`, mark it as beta in both SDKs:

- **Structural**: expose under the `beta.*` namespace (e.g. `opper.beta.web.search`). This is the primary signal to users.
- **Python**: decorate the method with `@beta` from `opperai._beta`. Emits a one-time `BetaWarning` (subclass of `FutureWarning`) on first call and prefixes the docstring with `[BETA]`.
- **TypeScript**: add a `@beta` JSDoc tag on the class and each method. IDE tooling surfaces it on hover; TSDoc-aware docs generators render it.

When an endpoint graduates (spec drops `x-beta: true`), remove the `@beta` decorator/JSDoc and optionally promote it out of the `beta.*` namespace in a minor release with a deprecation alias.

## Version Bumps & Changelogs

When bumping SDK versions, always update the corresponding changelog:

- **TypeScript**: `typescript/CHANGELOG.md`, version in `typescript/package.json`
- **Python**: `python/CHANGELOG.md`, version in `python/pyproject.toml`

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Add a link reference at the bottom for each new version. Group changes under `### Added`, `### Changed`, `### Fixed`, `### Removed` as appropriate. Mark breaking changes with **Breaking:** prefix.

## Integration Examples

Both SDKs have `examples/` directories with real integration tests that hit the live API.
They require `OPPER_API_KEY` set in `.env` or environment.

- **Python**: `python/examples/` — run individually via `uv run python examples/getting-started/06_video.py` or all via `uv run python examples/run_all.py`
- **TypeScript**: `typescript/examples/` — run individually with `npx tsx examples/getting-started/00-your-first-call.ts`

You can also curl the API directly to test spec changes before updating SDKs:

```bash
curl -H "Authorization: Bearer $OPPER_API_KEY" \
  https://api.opper.ai/v3/functions/{name}/call \
  -d '{"input": "hello"}'
```


