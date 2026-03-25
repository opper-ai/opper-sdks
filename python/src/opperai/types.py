"""Opper SDK — Type Definitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Generic, Literal, TypeVar

# ---------------------------------------------------------------------------
# JSON Utility Types
# ---------------------------------------------------------------------------

JsonSchema = dict[str, Any]
JsonValue = str | int | float | bool | None | list[Any] | dict[str, Any]

# Generic type variable for typed responses
T = TypeVar("T")

# SchemaLike: a JSON Schema dict or a type (Pydantic BaseModel, dataclass, TypedDict)
SchemaLike = JsonSchema | type

# ---------------------------------------------------------------------------
# SDK Configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RequestOptions:
    """Options for individual HTTP requests."""

    headers: dict[str, str] | None = None
    timeout: float | None = None  # seconds


# ---------------------------------------------------------------------------
# Error Types
# ---------------------------------------------------------------------------


class ApiError(Exception):
    """API error with status code and response body."""

    def __init__(self, status: int, status_text: str, body: Any = None) -> None:
        super().__init__(f"API Error {status}: {status_text}")
        self.status = status
        self.status_text = status_text
        self.body = body


# ---------------------------------------------------------------------------
# Core Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Tool:
    """Tool definition for function execution."""

    name: str
    description: str | None = None
    parameters: JsonSchema | type | None = None


@dataclass(frozen=True)
class UsageInfo:
    """Token usage information."""

    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int | None = None
    cache_read_tokens: int | None = None
    cache_creation_tokens: int | None = None
    cache_creation_1h_tokens: int | None = None
    input_audio_tokens: int | None = None
    output_audio_tokens: int | None = None


@dataclass(frozen=True)
class ResponseMeta:
    """Response metadata from function execution."""

    function_name: str = ""
    script_cached: bool = False
    execution_ms: int = 0
    llm_calls: int = 0
    tts_calls: int = 0
    image_gen_calls: int = 0
    generation_ms: int | None = None
    cost: float | None = None
    usage: UsageInfo | None = None
    models_used: list[str] | None = None
    model_warnings: list[str] | None = None
    guards: list[Any] | None = None
    message: str | None = None


@dataclass(frozen=True)
class RunResponse(Generic[T]):
    """Response from running a function."""

    data: T
    meta: ResponseMeta | None = None


class MediaResponse(RunResponse[T]):
    """Response from a media method, with a .save() helper to write output to a file.

    Example:
        result = opper.generate_image(prompt="A sunset")
        result.save("./sunset")  # -> "./sunset.jpeg" (extension auto-appended)
    """

    _base64_field: str
    _mime_field: str | None

    def __init__(self, data: T, meta: ResponseMeta | None, base64_field: str, mime_field: str | None = None) -> None:
        object.__setattr__(self, "data", data)
        object.__setattr__(self, "meta", meta)
        object.__setattr__(self, "_base64_field", base64_field)
        object.__setattr__(self, "_mime_field", mime_field)

    def save(self, path: str) -> str:
        """Save media content to a file. Returns the final path with auto-detected extension."""
        import base64
        from pathlib import Path

        data = self.data if isinstance(self.data, dict) else {}
        b64 = data.get(self._base64_field, "")
        mime = data.get(self._mime_field, "") if self._mime_field else ""

        # Auto-append extension from mime type if path has no extension
        p = Path(path)
        if not p.suffix and mime:
            ext = mime.split("/")[-1]
            # Normalize common mime subtypes
            if ext == "jpeg":
                ext = "jpg"
            p = p.with_suffix(f".{ext}")

        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(base64.b64decode(b64))
        return str(p)


# ---------------------------------------------------------------------------
# Stream Chunk Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ContentChunk:
    """SSE stream chunk: content text delta."""

    type: Literal["content"] = "content"
    delta: str = ""


@dataclass(frozen=True)
class ToolCallStartChunk:
    """SSE stream chunk: start of a tool call."""

    type: Literal["tool_call_start"] = "tool_call_start"
    tool_call_index: int = 0
    tool_call_id: str = ""
    tool_call_name: str = ""


@dataclass(frozen=True)
class ToolCallDeltaChunk:
    """SSE stream chunk: incremental tool call arguments."""

    type: Literal["tool_call_delta"] = "tool_call_delta"
    tool_call_index: int = 0
    tool_call_args: str = ""


@dataclass(frozen=True)
class DoneChunk:
    """SSE stream chunk: stream completed."""

    type: Literal["done"] = "done"
    usage: UsageInfo | None = None


@dataclass(frozen=True)
class ErrorChunk:
    """SSE stream chunk: error occurred."""

    type: Literal["error"] = "error"
    error: str = ""


@dataclass(frozen=True)
class CompleteChunk(Generic[T]):
    """SSE stream chunk: final parsed result from event: complete."""

    type: Literal["complete"] = "complete"
    data: T = None  # type: ignore[assignment]
    meta: ResponseMeta | None = None


StreamChunk = ContentChunk | ToolCallStartChunk | ToolCallDeltaChunk | DoneChunk | ErrorChunk | CompleteChunk

# ---------------------------------------------------------------------------
# Function Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FunctionInfo:
    """Summary function information."""

    name: str = ""
    schema_hash: str = ""
    generated_at: str = ""
    hit_count: int = 0
    has_script: bool = False


@dataclass(frozen=True)
class FunctionDetails:
    """Detailed function information including schemas."""

    name: str = ""
    schema_hash: str = ""
    generated_at: str = ""
    hit_count: int = 0
    source: str = ""
    input_schema: JsonSchema = field(default_factory=dict)
    output_schema: JsonSchema = field(default_factory=dict)


@dataclass(frozen=True)
class RevisionInfo:
    """Revision info summary."""

    revision_id: int = 0
    created_at: str = ""
    schema_hash: str = ""
    is_current: bool = False


@dataclass(frozen=True)
class FunctionRevision:
    """Function revision with schema details."""

    revision_id: int = 0
    source: str = ""
    schema_hash: str = ""
    created_at: str = ""
    input_schema: JsonSchema = field(default_factory=dict)
    output_schema: JsonSchema = field(default_factory=dict)


@dataclass(frozen=True)
class RealtimeCreateResponse:
    """Response from creating a realtime function."""

    name: str = ""
    script: str = ""
    cached: bool = False
    reasoning: str | None = None


# ---------------------------------------------------------------------------
# Span & Trace Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CreateSpanResponse:
    """Response from creating a span."""

    id: str = ""
    trace_id: str = ""
    name: str = ""
    parent_id: str | None = None
    type: str | None = None


@dataclass(frozen=True)
class SpanHandle:
    """Handle to the current span inside a trace context."""

    id: str
    trace_id: str


@dataclass(frozen=True)
class GetSpanResponse:
    """Response from getting a single span."""

    id: str = ""
    trace_id: str = ""
    name: str = ""
    parent_id: str | None = None
    type: str | None = None
    input: Any = None
    output: Any = None
    error: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    created_at: str | None = None
    status: str | None = None
    meta: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    tags: dict[str, Any] | None = None


@dataclass(frozen=True)
class TraceSpan:
    """Span details within a trace."""

    id: str = ""
    trace_id: str = ""
    name: str = ""
    parent_id: str | None = None
    type: str | None = None
    input: Any = None
    output: Any = None
    error: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    created_at: str | None = None
    status: str | None = None
    meta: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    tags: dict[str, Any] | None = None


@dataclass(frozen=True)
class ListTracesItem:
    """A trace item in list responses."""

    id: str = ""
    name: str | None = None
    span_count: int = 0
    start_time: str | None = None
    end_time: str | None = None
    duration_ms: int | None = None
    status: str | None = None


@dataclass(frozen=True)
class ListTracesResponse:
    """Response from listing traces."""

    data: list[ListTracesItem] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GetTraceResponse:
    """Response from getting a single trace with all its spans."""

    id: str = ""
    name: str | None = None
    span_count: int = 0
    spans: list[TraceSpan] = field(default_factory=list)
    start_time: str | None = None
    end_time: str | None = None
    duration_ms: int | None = None
    status: str | None = None


# ---------------------------------------------------------------------------
# Embeddings Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EmbeddingsDataItem:
    """A single embedding data item."""

    object: str = ""
    index: int = 0
    embedding: list[float] = field(default_factory=list)


@dataclass(frozen=True)
class EmbeddingsUsageInfo:
    """Token usage for embeddings requests."""

    prompt_tokens: int = 0
    total_tokens: int = 0


@dataclass(frozen=True)
class EmbeddingsResponse:
    """Embeddings response."""

    object: str = ""
    data: list[EmbeddingsDataItem] = field(default_factory=list)
    model: str = ""
    usage: EmbeddingsUsageInfo = field(default_factory=EmbeddingsUsageInfo)


# ---------------------------------------------------------------------------
# Models Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ModelInfo:
    """Information about an available model."""

    id: str = ""
    name: str = ""
    provider: str = ""
    capabilities: dict[str, Any] | None = None
    pricing: dict[str, Any] | None = None
    parameters: dict[str, Any] | None = None
    retired_at: str | None = None


@dataclass(frozen=True)
class ModelsResponse:
    """Response containing list of models."""

    models: list[ModelInfo] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Web Tools Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WebFetchResponse:
    """Response from fetching a URL."""

    content: str = ""


@dataclass(frozen=True)
class WebSearchResult:
    """A single web search result."""

    title: str = ""
    url: str = ""
    snippet: str = ""


@dataclass(frozen=True)
class WebSearchResponse:
    """Response from a web search."""

    results: list[WebSearchResult] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Knowledge Base Types (v2 API)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class KnowledgeBaseInfo:
    """Knowledge base summary in list responses."""

    id: str = ""
    name: str = ""
    created_at: str = ""
    embedding_model: str = ""


@dataclass(frozen=True)
class CreateKnowledgeBaseResponse:
    """Response from creating a knowledge base."""

    id: str = ""
    name: str = ""
    created_at: str = ""
    embedding_model: str = ""


@dataclass(frozen=True)
class GetKnowledgeBaseResponse:
    """Detailed knowledge base response including document count."""

    id: str = ""
    name: str = ""
    created_at: str = ""
    embedding_model: str = ""
    count: int = 0


@dataclass(frozen=True)
class AddDocumentResponse:
    """Response from adding a document."""

    id: str = ""
    key: str = ""
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class KnowledgeBaseFilter:
    """A filter condition for knowledge base queries."""

    field: str
    operation: str  # "=", "!=", ">", "<", "in"
    value: str | int | float | list[str | int | float]


@dataclass(frozen=True)
class QueryResult:
    """A single query result from a knowledge base."""

    id: str = ""
    key: str = ""
    content: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    score: float = 0.0


@dataclass(frozen=True)
class DocumentSegment:
    """A document segment."""

    id: str = ""
    content: str = ""


@dataclass(frozen=True)
class GetDocumentResponse:
    """Response from getting a document by key."""

    id: str = ""
    key: str = ""
    segments: list[DocumentSegment] = field(default_factory=list)
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class DeleteDocumentsResponse:
    """Response from deleting documents."""

    deleted_count: int = 0


@dataclass(frozen=True)
class GetUploadUrlResponse:
    """Response from getting a presigned upload URL."""

    url: str = ""
    fields: dict[str, Any] = field(default_factory=dict)
    id: str = ""


@dataclass(frozen=True)
class RegisterFileUploadResponse:
    """Response from registering a file upload."""

    id: str = ""
    key: str = ""
    original_filename: str = ""
    document_id: int = 0
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class UploadFileResponse:
    """Response from direct file upload."""

    id: str = ""
    key: str = ""
    original_filename: str = ""
    document_id: int = 0
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class FileInfo:
    """File information in list responses."""

    id: str = ""
    original_filename: str = ""
    size: int = 0
    status: str = ""
    document_id: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Generations Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GenerationsListMeta:
    """Pagination metadata for generations list."""

    page: int = 1
    page_size: int = 50
    total: int = 0
    total_pages: int = 0


@dataclass(frozen=True)
class GenerationsListResponse:
    """Response from listing generations."""

    data: list[dict[str, Any]] = field(default_factory=list)
    meta: GenerationsListMeta = field(default_factory=GenerationsListMeta)


# ---------------------------------------------------------------------------
# Media Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GeneratedImage:
    """Generated image data."""

    url: str | None = None
    base64: str | None = None
    mime_type: str | None = None


@dataclass(frozen=True)
class GeneratedVideo:
    """Generated video data."""

    url: str | None = None
    base64: str | None = None
    mime_type: str | None = None


@dataclass(frozen=True)
class GeneratedSpeech:
    """Generated speech audio data."""

    audio: str | None = None  # base64
    mime_type: str | None = None


@dataclass(frozen=True)
class Transcription:
    """Transcription result."""

    text: str = ""


# ---------------------------------------------------------------------------
# System Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HealthResponse:
    """Health check response."""

    status: str = ""
