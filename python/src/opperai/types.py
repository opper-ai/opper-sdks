"""Opper SDK — Type Definitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Generic, Literal, TypedDict, TypeVar

# ---------------------------------------------------------------------------
# MIME type to file extension mapping
# ---------------------------------------------------------------------------

_MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
    "video/webm": "webm",
}

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


class ErrorDetail(TypedDict, total=False):
    """Structured error detail from the API (matches OpenAPI ErrorDetail schema)."""

    code: str
    message: str
    details: Any


class ApiError(Exception):
    """API error with status code and structured error info."""

    def __init__(self, status: int, status_text: str, body: Any = None) -> None:
        detail = self.parse_detail(body)
        msg = f"{status} {status_text}: {detail.get('message', '')}" if detail else f"{status} {status_text}"
        super().__init__(msg)
        self.status = status
        self.status_text = status_text
        self.body = body

    @property
    def error(self) -> ErrorDetail | None:
        """Parsed error detail from the response body, if available."""
        return self.parse_detail(self.body)

    @staticmethod
    def parse_detail(body: Any) -> ErrorDetail | None:
        """Extract structured ErrorDetail from a response body."""
        if isinstance(body, dict) and isinstance(body.get("error"), dict):
            e = body["error"]
            if isinstance(e.get("code"), str) and isinstance(e.get("message"), str):
                return ErrorDetail(code=e["code"], message=e["message"], details=e.get("details"))
        return None


class BadRequestError(ApiError):
    """400 Bad Request — invalid input or malformed request."""

    def __init__(self, status_text: str, body: Any = None) -> None:
        super().__init__(400, status_text, body)


class AuthenticationError(ApiError):
    """401 Unauthorized — missing or invalid API key."""

    def __init__(self, status_text: str, body: Any = None) -> None:
        super().__init__(401, status_text, body)


class NotFoundError(ApiError):
    """404 Not Found — the requested resource does not exist."""

    def __init__(self, status_text: str, body: Any = None) -> None:
        super().__init__(404, status_text, body)


class RateLimitError(ApiError):
    """429 Too Many Requests — rate limit exceeded."""

    def __init__(self, status_text: str, body: Any = None) -> None:
        super().__init__(429, status_text, body)


class InternalServerError(ApiError):
    """500 Internal Server Error — something went wrong on the server."""

    def __init__(self, status_text: str, body: Any = None) -> None:
        super().__init__(500, status_text, body)


# ---------------------------------------------------------------------------
# Core Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Tool:
    """Tool definition for function execution."""

    name: str
    description: str | None = None
    parameters: JsonSchema | type | None = None
    type: str | None = None


@dataclass(frozen=True)
class UsageInfo:
    """Token usage information."""

    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int | None = None
    cache_read_tokens: int | None = None
    cache_creation_tokens: int | None = None
    cache_creation_1h_tokens: int | None = None


@dataclass(frozen=True)
class PendingOperation:
    """An async operation that is still in progress."""

    id: str
    status_url: str
    type: str


@dataclass(frozen=True)
class ArtifactStatus:
    """Status of an async artifact generation."""

    id: str
    status: str  # "processing" | "completed" | "failed"
    url: str | None = None
    mime_type: str | None = None
    error: str | None = None


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
    status: str | None = None
    pending_operations: list[PendingOperation] | None = None


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
            ext = _MIME_TO_EXT.get(mime, mime.split("/")[-1])
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
class CreateSpanRequest:
    """Request to create a span."""

    name: str
    trace_id: str | None = None
    parent_id: str | None = None
    type: str | None = None
    input: str | None = None
    output: str | None = None
    error: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    meta: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    tags: dict[str, Any] | None = None


@dataclass(frozen=True)
class UpdateSpanRequest:
    """Request to update a span."""

    output: str | None = None
    error: str | None = None
    end_time: str | None = None
    meta: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    tags: dict[str, Any] | None = None


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
    type: str = ""
    provider: str = ""
    provider_display_name: str = ""
    model_id: str = ""
    description: str = ""
    capabilities: list[str] = field(default_factory=list)
    speed: str = ""
    quality: str = ""
    cost: float = 0.0
    context_window: int = 0
    params: dict[str, Any] = field(default_factory=dict)
    pricing: dict[str, Any] = field(default_factory=dict)
    region: str = ""
    country: str = ""
    api_type: str = ""
    aliases: list[str] = field(default_factory=list)
    retired_at: str | None = None
    successor: str | None = None


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
    total_count: int = 0
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
