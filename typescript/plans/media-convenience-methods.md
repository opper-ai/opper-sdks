# Media Convenience Methods for Opper SDK

## Status: Planned (not yet implemented)

## Context
Media operations require manually defining `input_schema`/`output_schema` with exact field names matching the platform's Starlark builtins. This is verbose and error-prone. Adding convenience methods with typed options lets users do `opper.generateImage("name", { prompt: "..." })` instead.

## Approach
Thin wrappers on the `Opper` class that delegate to `this.call<T>()` with pre-filled schemas. No new API endpoints.

**Key design decision:** Use typed interfaces for autocomplete/DX, but build `input_schema` dynamically from only the fields the user actually passes. This avoids polluting the schema with unused fields (which affects script generation and caching) while keeping type safety.

## Methods

| Method | Required input | Builtin | Returns |
|---|---|---|---|
| `generateImage(name, {prompt, ...})` | `prompt` | `image_gen` | `{image, mime_type}` |
| `editImage(name, {image, prompt, ...})` | `image`, `prompt` | `image_edit` | `{edited_image, mime_type}` |
| `generateVideo(name, {prompt, ...})` | `prompt` | `video_gen` | `{video, mime_type}` |
| `tts(name, {text, ...})` | `text` | `tts` | `{audio}` |
| `transcribe(name, {audio, ...})` | `audio` | `stt` | `{text, language}` |

## Per-method options (all optional)

### generateImage
- `model` — e.g. "openai/dall-e-3", "pruna/p-image"
- `size` — e.g. "1024x1024", "1792x1024"
- `quality` — "standard", "hd", "high", "medium", "low"
- `style` — "vivid", "natural" (DALL-E 3)
- `n` — number of images (default 1)

### editImage
- `model` — e.g. "pruna/p-image-edit"
- `aspect_ratio` — e.g. "16:9", "1:1"
- `seed` — reproducibility

### generateVideo
- `model` — "pruna/vace", "openai/sora-2", "xai/grok-imagine-video"
- `source_image` — base64 first frame
- `source_video` — base64 reference video
- `ref_images` — base64 style references
- `aspect_ratio`, `resolution`, `frame_num`, `fps`, `speed_mode`, `seed`

### tts
- `model` — e.g. "openai/tts-1"
- `voice` — default "alloy"

### transcribe
- `model` — e.g. "openai/whisper-1"
- `language` — ISO-639-1 hint
- `prompt` — context to guide transcription

## Dynamic schema construction

Only include fields in `input_schema` that the user actually provides:

```typescript
// User calls:
opper.generateImage("my-fn", { prompt: "sunset", size: "1024x1024" });

// SDK builds input_schema with only { description, size }
// Not all possible fields — avoids bloating schema hash and confusing script generator
```

## Field name mapping

Public API uses natural names, mapped internally:
- `generateImage({ prompt })` → input `{ description }`
- `editImage({ prompt })` → input `{ edit_prompt }`
- All others: 1:1 mapping

## Files to create/modify
- `src/media.ts` (new) — types, schema builder helpers
- `src/index.ts` — add methods to Opper class, re-export types
- Examples — update to show convenience methods

## Open questions
- Should `model` be top-level on the request or inside input? (top-level is cleaner, maps to RunRequest.model)
- Do we need a `describeImage` method for vision, or is that too close to a regular `call()`?
