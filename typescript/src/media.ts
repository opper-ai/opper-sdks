// =============================================================================
// Media Convenience Methods — Types, Schema Builders, and Helpers
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import type { JsonSchema, JsonValue, RequestOptions, RunRequest, RunResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Media Input Type
// ---------------------------------------------------------------------------

/** Flexible media input: base64 string, raw Buffer, or a file path to read. */
export type MediaInput = string | Buffer | { path: string };

/** Resolve a MediaInput to a base64 string. */
function resolveMediaInput(input: MediaInput): string {
  if (typeof input === "string") return input;
  if (Buffer.isBuffer(input)) return input.toString("base64");
  return readFileSync(input.path).toString("base64");
}

// ---------------------------------------------------------------------------
// Save Helper
// ---------------------------------------------------------------------------

/**
 * Save base64-encoded media to a file.
 *
 * When `mimeType` is provided the correct extension is appended automatically
 * (e.g. `"image/jpeg"` → `.jpeg`). Returns the final file path used.
 *
 * @example
 * ```typescript
 * const result = await opper.generateImage({ prompt: "A sunset" });
 * const path = saveMedia(result.data.image, "./media/sunset", result.data.mime_type);
 * // → "./media/sunset.jpeg"
 *
 * // Or with an explicit extension — mimeType is ignored:
 * saveMedia(result.data.image, "./media/sunset.png");
 * ```
 */
export function saveMedia(base64: string, filePath: string, mimeType?: string): string {
  const hasExtension = /\.\w+$/.test(filePath);
  let finalPath = filePath;
  if (!hasExtension && mimeType) {
    const ext = mimeType.split("/")[1] || "bin";
    finalPath = `${filePath}.${ext}`;
  }
  writeFileSync(finalPath, Buffer.from(base64, "base64"));
  return finalPath;
}

// ---------------------------------------------------------------------------
// Media Response
// ---------------------------------------------------------------------------

/**
 * Response from a media method, with a `.save()` helper to write the output to a file.
 *
 * @example
 * ```typescript
 * const result = await opper.generateImage({ prompt: "A sunset" });
 * result.save("./sunset"); // → "./sunset.jpeg" (extension auto-appended)
 * result.data.image;       // still a plain base64 string
 * ```
 */
export interface MediaResponse<T> extends RunResponse<T> {
  /** Save the media output to a file. Returns the final file path (with extension). */
  save(filePath: string): string;
}

/** Wrap a RunResponse with a .save() method that knows which field to write. */
export function mediaResponse<T>(
  response: RunResponse<T>,
  base64Field: keyof T,
  mimeField?: keyof T,
): MediaResponse<T> {
  return {
    ...response,
    save(filePath: string): string {
      const base64 = response.data[base64Field] as string;
      const mime = mimeField ? (response.data[mimeField] as string) : undefined;
      return saveMedia(base64, filePath, mime);
    },
  };
}

// ---------------------------------------------------------------------------
// Shared Base Options
// ---------------------------------------------------------------------------

/** Options shared by all media methods. */
export interface MediaBaseOptions {
  /** Model to use, e.g. `"openai/dall-e-3"` or `"pruna/p-image"`. */
  readonly model?: string;
  /** Instructions for the function. */
  readonly instructions?: string;
  /** Parent span ID for tracing/observability. */
  readonly parent_span_id?: string;
}

// ---------------------------------------------------------------------------
// Per-Method Option Interfaces
// ---------------------------------------------------------------------------

/** Options for `generateImage()`. */
export interface GenerateImageOptions extends MediaBaseOptions {
  /** Text description of the image to generate (or edits to apply when a reference image is provided). */
  readonly prompt: string;
  /** Optional reference image — base64 string, Buffer, or `{ path }` to a file. */
  readonly reference_image?: MediaInput;
  /** Image size, e.g. `"1024x1024"`, `"1792x1024"`. */
  readonly size?: string;
  /** Image quality: `"standard"`, `"hd"`, `"high"`, `"medium"`, `"low"`. */
  readonly quality?: string;
  /** Image style: `"vivid"`, `"natural"` (DALL-E 3). */
  readonly style?: string;
  /** Number of images to generate (default 1). */
  readonly n?: number;
  /** Requested output MIME type, e.g. `"image/webp"`. */
  readonly mime_type?: string;
}

/** Options for `generateVideo()`. */
export interface GenerateVideoOptions extends MediaBaseOptions {
  /** Text description of the video to generate. */
  readonly prompt: string;
  /** Base64 image (or Buffer / `{ path }`) to use as first frame. */
  readonly source_image?: MediaInput;
  /** Base64 video (or Buffer / `{ path }`) to use as reference. */
  readonly source_video?: MediaInput;
  /** Base64 reference images for style. */
  readonly ref_images?: MediaInput[];
  /** Output aspect ratio, e.g. `"16:9"`, `"1:1"`. */
  readonly aspect_ratio?: string;
  /** Output resolution, e.g. `"720p"`. */
  readonly resolution?: string;
  /** Number of frames (controls duration). */
  readonly frame_num?: number;
  /** Frames per second. */
  readonly fps?: number;
  /** Generation speed hint. */
  readonly speed_mode?: string;
  /** Seed for reproducibility. */
  readonly seed?: number;
  /** Requested output MIME type, e.g. `"video/webm"`. */
  readonly mime_type?: string;
}

/** Options for `textToSpeech()`. */
export interface TextToSpeechOptions extends MediaBaseOptions {
  /** Text to convert to speech. */
  readonly text: string;
  /** Voice to use, e.g. `"alloy"`. */
  readonly voice?: string;
}

/** Options for `transcribe()`. */
export interface SpeechToTextOptions extends MediaBaseOptions {
  /** Base64 audio data, Buffer, or `{ path }` to the audio file. */
  readonly audio: MediaInput;
  /** ISO-639-1 language hint, e.g. `"en"`. */
  readonly language?: string;
  /** Context to guide transcription. */
  readonly prompt?: string;
}

// ---------------------------------------------------------------------------
// Response Interfaces
// ---------------------------------------------------------------------------

/** Result from `generateImage()`. */
export interface GeneratedImage {
  readonly image: string;
  readonly mime_type: string;
}

/** Result from `generateVideo()`. */
export interface GeneratedVideo {
  readonly video: string;
  readonly mime_type: string;
}

/** Result from `textToSpeech()`. */
export interface GeneratedSpeech {
  readonly audio: string;
}

/** Result from `transcribe()`. */
export interface Transcription {
  readonly text: string;
  readonly language: string;
}

// ---------------------------------------------------------------------------
// Overload Argument Resolution
// ---------------------------------------------------------------------------

/**
 * Disambiguate the overloaded (name?, options, requestOptions?) pattern.
 * Returns `[name, options, requestOptions]`.
 */
export function resolveMediaArgs<T>(
  defaultName: string,
  first: string | T,
  second?: T | RequestOptions,
  third?: RequestOptions,
): [string, T, RequestOptions | undefined] {
  if (typeof first === "string") {
    return [first, second as T, third];
  }
  return [defaultName, first, second as RequestOptions | undefined];
}

// ---------------------------------------------------------------------------
// JSON Schema Helpers (private)
// ---------------------------------------------------------------------------

function jsonStr(description: string): { type: "string"; description: string } {
  return { type: "string", description };
}

function jsonNum(description: string): { type: "number"; description: string } {
  return { type: "number", description };
}

function jsonStrArray(description: string) {
  return { type: "array", items: { type: "string" }, description };
}

function buildObjectSchema(properties: Record<string, unknown>, required: string[]): JsonSchema {
  return { type: "object", properties, required };
}

/** Extract RunRequest-level fields from media options, returning only those that are set. */
function extractRequestFields(
  opts: MediaBaseOptions,
): Pick<RunRequest, "model" | "instructions" | "parent_span_id"> {
  const out: Record<string, unknown> = {};
  if (opts.model) out.model = opts.model;
  if (opts.instructions) out.instructions = opts.instructions;
  if (opts.parent_span_id) out.parent_span_id = opts.parent_span_id;
  return out as Pick<RunRequest, "model" | "instructions" | "parent_span_id">;
}

// ---------------------------------------------------------------------------
// Request Builders
// ---------------------------------------------------------------------------

export function buildGenerateImageRequest(opts: GenerateImageOptions): RunRequest {
  const inputProps: Record<string, unknown> = {
    description: jsonStr("Text description of the image to generate"),
  };
  const inputValues: Record<string, JsonValue> = { description: opts.prompt };

  if (opts.reference_image !== undefined) {
    inputProps.reference_image = jsonStr("Base64-encoded reference image");
    inputValues.reference_image = resolveMediaInput(opts.reference_image);
  }
  if (opts.size !== undefined) {
    inputProps.size = jsonStr("Image size");
    inputValues.size = opts.size;
  }
  if (opts.quality !== undefined) {
    inputProps.quality = jsonStr("Image quality");
    inputValues.quality = opts.quality;
  }
  if (opts.style !== undefined) {
    inputProps.style = jsonStr("Image style");
    inputValues.style = opts.style;
  }
  if (opts.n !== undefined) {
    inputProps.n = jsonNum("Number of images");
    inputValues.n = opts.n;
  }
  if (opts.mime_type !== undefined) {
    inputProps.mime_type = jsonStr("Requested output MIME type");
    inputValues.mime_type = opts.mime_type;
  }

  return {
    input_schema: buildObjectSchema(inputProps, ["description"]),
    output_schema: buildObjectSchema(
      {
        image: jsonStr("Base64-encoded image data"),
        mime_type: jsonStr("MIME type of the generated image"),
      },
      ["image", "mime_type"],
    ),
    input: inputValues as JsonValue,
    ...extractRequestFields(opts),
  };
}

export function buildGenerateVideoRequest(opts: GenerateVideoOptions): RunRequest {
  const inputProps: Record<string, unknown> = {
    prompt: jsonStr("Text description of the video to generate"),
  };
  const inputValues: Record<string, JsonValue> = { prompt: opts.prompt };

  if (opts.source_image !== undefined) {
    inputProps.source_image = jsonStr("Base64 image to use as first frame");
    inputValues.source_image = resolveMediaInput(opts.source_image);
  }
  if (opts.source_video !== undefined) {
    inputProps.source_video = jsonStr("Base64 video to use as reference");
    inputValues.source_video = resolveMediaInput(opts.source_video);
  }
  if (opts.ref_images !== undefined) {
    inputProps.ref_images = jsonStrArray("Base64 reference images for style");
    inputValues.ref_images = opts.ref_images.map(resolveMediaInput) as unknown as JsonValue;
  }
  if (opts.aspect_ratio !== undefined) {
    inputProps.aspect_ratio = jsonStr("Output aspect ratio");
    inputValues.aspect_ratio = opts.aspect_ratio;
  }
  if (opts.resolution !== undefined) {
    inputProps.resolution = jsonStr("Output resolution");
    inputValues.resolution = opts.resolution;
  }
  if (opts.frame_num !== undefined) {
    inputProps.frame_num = jsonNum("Number of frames");
    inputValues.frame_num = opts.frame_num;
  }
  if (opts.fps !== undefined) {
    inputProps.fps = jsonNum("Frames per second");
    inputValues.fps = opts.fps;
  }
  if (opts.speed_mode !== undefined) {
    inputProps.speed_mode = jsonStr("Generation speed hint");
    inputValues.speed_mode = opts.speed_mode;
  }
  if (opts.seed !== undefined) {
    inputProps.seed = jsonNum("Seed for reproducibility");
    inputValues.seed = opts.seed;
  }
  if (opts.mime_type !== undefined) {
    inputProps.mime_type = jsonStr("Requested output MIME type");
    inputValues.mime_type = opts.mime_type;
  }

  return {
    input_schema: buildObjectSchema(inputProps, ["prompt"]),
    output_schema: buildObjectSchema(
      {
        video: jsonStr("Base64-encoded video data"),
        mime_type: jsonStr("MIME type of the generated video"),
      },
      ["video", "mime_type"],
    ),
    input: inputValues as JsonValue,
    ...extractRequestFields(opts),
  };
}

export function buildTextToSpeechRequest(opts: TextToSpeechOptions): RunRequest {
  const inputProps: Record<string, unknown> = {
    text: jsonStr("Text to convert to speech"),
  };
  const inputValues: Record<string, JsonValue> = { text: opts.text };

  if (opts.voice !== undefined) {
    inputProps.voice = jsonStr("Voice to use");
    inputValues.voice = opts.voice;
  }

  return {
    input_schema: buildObjectSchema(inputProps, ["text"]),
    output_schema: buildObjectSchema({ audio: jsonStr("Base64-encoded audio data") }, ["audio"]),
    input: inputValues as JsonValue,
    ...extractRequestFields(opts),
  };
}

export function buildSpeechToTextRequest(opts: SpeechToTextOptions): RunRequest {
  const inputProps: Record<string, unknown> = {
    audio: jsonStr("Base64-encoded audio to transcribe"),
  };
  const inputValues: Record<string, JsonValue> = {
    audio: resolveMediaInput(opts.audio),
  };

  if (opts.language !== undefined) {
    inputProps.language = jsonStr("Language hint (ISO-639-1)");
    inputValues.language = opts.language;
  }
  if (opts.prompt !== undefined) {
    inputProps.prompt = jsonStr("Context to guide transcription");
    inputValues.prompt = opts.prompt;
  }

  return {
    input_schema: buildObjectSchema(inputProps, ["audio"]),
    output_schema: buildObjectSchema(
      {
        text: jsonStr("Transcribed text"),
        language: jsonStr("Detected language code"),
      },
      ["text", "language"],
    ),
    input: inputValues as JsonValue,
    ...extractRequestFields(opts),
  };
}
