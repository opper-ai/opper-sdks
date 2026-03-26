import { describe, expect, it, vi } from "vitest";
import {
  buildGenerateImageRequest,
  buildGenerateVideoRequest,
  buildSpeechToTextRequest,
  buildTextToSpeechRequest,
  resolveMediaArgs,
  saveMedia,
} from "../media.js";
import type { GenerateImageOptions, TextToSpeechOptions } from "../media.js";

// Mock node:fs for saveMedia tests (ESM modules can't be spied on)
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: vi.fn(),
    readFileSync: actual.readFileSync,
  };
});

// ---------------------------------------------------------------------------
// resolveMediaArgs
// ---------------------------------------------------------------------------

describe("resolveMediaArgs", () => {
  it("returns custom name when first arg is string", () => {
    const opts: GenerateImageOptions = { prompt: "a sunset" };
    const [name, options, reqOpts] = resolveMediaArgs("default-name", "custom-name", opts);
    expect(name).toBe("custom-name");
    expect(options.prompt).toBe("a sunset");
    expect(reqOpts).toBeUndefined();
  });

  it("returns default name when first arg is options", () => {
    const opts: GenerateImageOptions = { prompt: "a sunset" };
    const [name, options, reqOpts] = resolveMediaArgs("default-name", opts);
    expect(name).toBe("default-name");
    expect(options.prompt).toBe("a sunset");
    expect(reqOpts).toBeUndefined();
  });

  it("passes request options through with custom name", () => {
    const opts: GenerateImageOptions = { prompt: "a sunset" };
    const ro = { headers: { "X-Custom": "yes" } };
    const [name, options, reqOpts] = resolveMediaArgs("default", "my-fn", opts, ro);
    expect(name).toBe("my-fn");
    expect(options.prompt).toBe("a sunset");
    expect(reqOpts).toBe(ro);
  });

  it("passes request options through with default name", () => {
    const opts: GenerateImageOptions = { prompt: "a sunset" };
    const ro = { headers: { "X-Custom": "yes" } };
    const [name, _options, reqOpts] = resolveMediaArgs("default", opts, ro);
    expect(name).toBe("default");
    expect(reqOpts).toBe(ro);
  });
});

// ---------------------------------------------------------------------------
// buildGenerateImageRequest
// ---------------------------------------------------------------------------

describe("buildGenerateImageRequest", () => {
  it("builds minimal request with just prompt", () => {
    const req = buildGenerateImageRequest({ prompt: "a sunset" });
    expect(req.input).toEqual({ description: "a sunset" });
    expect((req.input_schema as any).required).toEqual(["description"]);
    expect((req.output_schema as any).required).toContain("image");
    expect((req.output_schema as any).required).toContain("mime_type");
  });

  it("includes optional fields when set", () => {
    const req = buildGenerateImageRequest({
      prompt: "a cat",
      size: "1024x1024",
      quality: "hd",
      style: "vivid",
      n: 2,
      mime_type: "image/webp",
    });
    const input = req.input as Record<string, unknown>;
    expect(input.description).toBe("a cat");
    expect(input.size).toBe("1024x1024");
    expect(input.quality).toBe("hd");
    expect(input.style).toBe("vivid");
    expect(input.n).toBe(2);
    expect(input.mime_type).toBe("image/webp");

    const schema = req.input_schema as any;
    expect(schema.properties).toHaveProperty("size");
    expect(schema.properties).toHaveProperty("quality");
    expect(schema.properties).toHaveProperty("n");
  });

  it("resolves base64 string reference image", () => {
    const req = buildGenerateImageRequest({
      prompt: "edit this",
      reference_image: "abc123base64",
    });
    expect((req.input as any).reference_image).toBe("abc123base64");
  });

  it("resolves Buffer reference image to base64", () => {
    const buf = Buffer.from("hello image");
    const req = buildGenerateImageRequest({
      prompt: "edit this",
      reference_image: buf,
    });
    expect((req.input as any).reference_image).toBe(buf.toString("base64"));
  });

  it("passes model and instructions as request-level fields", () => {
    const req = buildGenerateImageRequest({
      prompt: "a sunset",
      model: "openai/dall-e-3",
      instructions: "photorealistic",
      parent_span_id: "span-123",
    });
    expect(req.model).toBe("openai/dall-e-3");
    expect(req.instructions).toBe("photorealistic");
    expect(req.parent_span_id).toBe("span-123");
  });

  it("omits model/instructions when not set", () => {
    const req = buildGenerateImageRequest({ prompt: "a sunset" });
    expect(req.model).toBeUndefined();
    expect(req.instructions).toBeUndefined();
    expect(req.parent_span_id).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildGenerateVideoRequest
// ---------------------------------------------------------------------------

describe("buildGenerateVideoRequest", () => {
  it("builds minimal request with just prompt", () => {
    const req = buildGenerateVideoRequest({ prompt: "ocean waves" });
    expect(req.input).toEqual({ prompt: "ocean waves" });
    expect((req.input_schema as any).required).toEqual(["prompt"]);
    expect((req.output_schema as any).required).toContain("video");
    expect((req.output_schema as any).required).toContain("mime_type");
  });

  it("includes all optional video fields", () => {
    const req = buildGenerateVideoRequest({
      prompt: "a cat",
      aspect_ratio: "16:9",
      resolution: "720p",
      frame_num: 120,
      fps: 24,
      speed_mode: "fast",
      seed: 42,
      mime_type: "video/webm",
    });
    const input = req.input as Record<string, unknown>;
    expect(input.aspect_ratio).toBe("16:9");
    expect(input.resolution).toBe("720p");
    expect(input.frame_num).toBe(120);
    expect(input.fps).toBe(24);
    expect(input.speed_mode).toBe("fast");
    expect(input.seed).toBe(42);
    expect(input.mime_type).toBe("video/webm");
  });

  it("resolves source_image and source_video", () => {
    const req = buildGenerateVideoRequest({
      prompt: "a cat",
      source_image: "base64img",
      source_video: "base64vid",
    });
    expect((req.input as any).source_image).toBe("base64img");
    expect((req.input as any).source_video).toBe("base64vid");
  });

  it("resolves ref_images array", () => {
    const req = buildGenerateVideoRequest({
      prompt: "a cat",
      ref_images: ["img1", "img2"],
    });
    expect((req.input as any).ref_images).toEqual(["img1", "img2"]);
  });
});

// ---------------------------------------------------------------------------
// buildTextToSpeechRequest
// ---------------------------------------------------------------------------

describe("buildTextToSpeechRequest", () => {
  it("builds minimal request with just text", () => {
    const req = buildTextToSpeechRequest({ text: "hello world" });
    expect(req.input).toEqual({ text: "hello world" });
    expect((req.input_schema as any).required).toEqual(["text"]);
    expect((req.output_schema as any).required).toEqual(["audio"]);
  });

  it("includes voice when set", () => {
    const req = buildTextToSpeechRequest({ text: "hello", voice: "alloy" });
    expect((req.input as any).voice).toBe("alloy");
    expect((req.input_schema as any).properties).toHaveProperty("voice");
  });
});

// ---------------------------------------------------------------------------
// buildSpeechToTextRequest
// ---------------------------------------------------------------------------

describe("buildSpeechToTextRequest", () => {
  it("builds minimal request with audio string", () => {
    const req = buildSpeechToTextRequest({ audio: "base64audio" });
    expect((req.input as any).audio).toBe("base64audio");
    expect((req.input_schema as any).required).toEqual(["audio"]);
    expect((req.output_schema as any).required).toContain("text");
    expect((req.output_schema as any).required).toContain("language");
  });

  it("includes language and prompt when set", () => {
    const req = buildSpeechToTextRequest({
      audio: "base64audio",
      language: "en",
      prompt: "context hint",
    });
    expect((req.input as any).language).toBe("en");
    expect((req.input as any).prompt).toBe("context hint");
  });

  it("resolves Buffer audio to base64", () => {
    const buf = Buffer.from("audio data");
    const req = buildSpeechToTextRequest({ audio: buf });
    expect((req.input as any).audio).toBe(buf.toString("base64"));
  });
});

// ---------------------------------------------------------------------------
// saveMedia
// ---------------------------------------------------------------------------

describe("saveMedia", () => {
  it("appends extension from mime_type when path has no extension", async () => {
    const { writeFileSync } = await import("node:fs");
    const result = saveMedia("aGVsbG8=", "/tmp/test-file", "image/jpeg");
    expect(result).toBe("/tmp/test-file.jpeg");
    expect(writeFileSync).toHaveBeenCalledWith(
      "/tmp/test-file.jpeg",
      expect.any(Buffer),
    );
  });

  it("does not append extension when path already has one", () => {
    const result = saveMedia("aGVsbG8=", "/tmp/test-file.png", "image/jpeg");
    expect(result).toBe("/tmp/test-file.png");
  });

  it("does not append extension when no mime_type provided", () => {
    const result = saveMedia("aGVsbG8=", "/tmp/test-file");
    expect(result).toBe("/tmp/test-file");
  });

  it("writes correct buffer from base64", async () => {
    const { writeFileSync } = await import("node:fs");
    const mock = vi.mocked(writeFileSync);
    mock.mockClear();
    saveMedia("aGVsbG8=", "/tmp/out.bin");
    const writtenBuffer = mock.mock.calls[0][1] as Buffer;
    expect(writtenBuffer.toString("utf-8")).toBe("hello");
  });
});
