# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0-beta.2] - 2026-03-31

### Added

- `PendingOperation` and `ArtifactStatus` types for async artifact generation
- `pending_operations` and `status` fields on `ResponseMeta`
- `ArtifactsClient` with `getStatus()` for polling artifact generation status
- `generateVideo()` now auto-polls pending operations and downloads the result

## [4.0.0-beta.0] - 2026-03-30

### Changed

- New major version built for Opper API v3

[4.0.0-beta.2]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.2
[4.0.0-beta.0]: https://github.com/opper-ai/opper-sdks/releases/tag/ts-v4.0.0-beta.0
