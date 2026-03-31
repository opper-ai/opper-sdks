# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.0.0b3]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b3
[2.0.0b2]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b2
[2.0.0b1]: https://github.com/opper-ai/opper-sdks/releases/tag/py-v2.0.0b1
