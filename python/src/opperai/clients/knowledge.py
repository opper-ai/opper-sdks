"""Opper SDK — Knowledge Base Client (v2 API)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .._base_client import BaseClient
from ..types import (
    AddDocumentResponse,
    CreateKnowledgeBaseResponse,
    DeleteDocumentsResponse,
    FileInfo,
    GetDocumentResponse,
    GetKnowledgeBaseResponse,
    GetUploadUrlResponse,
    KnowledgeBaseInfo,
    QueryResult,
    RegisterFileUploadResponse,
    RequestOptions,
    UploadFileResponse,
)

KB_PATH = "/v2/knowledge"


class KnowledgeClient:
    """Client for the Knowledge Base API (v2)."""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    # --- Knowledge Base CRUD --------------------------------------------------

    def create(
        self,
        *,
        name: str,
        embedding_model: str | None = None,
        options: RequestOptions | None = None,
    ) -> CreateKnowledgeBaseResponse:
        body: dict[str, Any] = {"name": name}
        if embedding_model is not None:
            body["embedding_model"] = embedding_model
        data = self._client._post(KB_PATH, body, options=options)
        return CreateKnowledgeBaseResponse(**data)

    async def create_async(
        self,
        *,
        name: str,
        embedding_model: str | None = None,
        options: RequestOptions | None = None,
    ) -> CreateKnowledgeBaseResponse:
        body: dict[str, Any] = {"name": name}
        if embedding_model is not None:
            body["embedding_model"] = embedding_model
        data = await self._client._post_async(KB_PATH, body, options=options)
        return CreateKnowledgeBaseResponse(**data)

    def list(
        self,
        *,
        offset: int | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> list[KnowledgeBaseInfo]:
        query: dict[str, Any] = {}
        if offset is not None:
            query["offset"] = offset
        if limit is not None:
            query["limit"] = limit
        data = self._client._get(KB_PATH, query=query, options=options)
        return [KnowledgeBaseInfo(**kb) for kb in (data or {}).get("data", [])]

    async def list_async(
        self,
        *,
        offset: int | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> list[KnowledgeBaseInfo]:
        query: dict[str, Any] = {}
        if offset is not None:
            query["offset"] = offset
        if limit is not None:
            query["limit"] = limit
        data = await self._client._get_async(KB_PATH, query=query, options=options)
        return [KnowledgeBaseInfo(**kb) for kb in (data or {}).get("data", [])]

    def get(self, id: str, *, options: RequestOptions | None = None) -> GetKnowledgeBaseResponse:
        data = self._client._get(f"{KB_PATH}/{quote(id, safe='')}", options=options)
        return GetKnowledgeBaseResponse(**data)

    async def get_async(self, id: str, *, options: RequestOptions | None = None) -> GetKnowledgeBaseResponse:
        data = await self._client._get_async(f"{KB_PATH}/{quote(id, safe='')}", options=options)
        return GetKnowledgeBaseResponse(**data)

    def get_by_name(self, name: str, *, options: RequestOptions | None = None) -> GetKnowledgeBaseResponse:
        data = self._client._get(f"{KB_PATH}/by-name/{quote(name, safe='')}", options=options)
        return GetKnowledgeBaseResponse(**data)

    async def get_by_name_async(self, name: str, *, options: RequestOptions | None = None) -> GetKnowledgeBaseResponse:
        data = await self._client._get_async(f"{KB_PATH}/by-name/{quote(name, safe='')}", options=options)
        return GetKnowledgeBaseResponse(**data)

    def delete(self, id: str, *, options: RequestOptions | None = None) -> None:
        self._client._delete(f"{KB_PATH}/{quote(id, safe='')}", options=options)

    async def delete_async(self, id: str, *, options: RequestOptions | None = None) -> None:
        await self._client._delete_async(f"{KB_PATH}/{quote(id, safe='')}", options=options)

    # --- Documents ------------------------------------------------------------

    def add(
        self,
        kb_id: str,
        *,
        content: str,
        key: str | None = None,
        metadata: dict[str, Any] | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        options: RequestOptions | None = None,
    ) -> AddDocumentResponse:
        body: dict[str, Any] = {"content": content}
        if key is not None:
            body["key"] = key
        if metadata is not None:
            body["metadata"] = metadata
        config: dict[str, Any] = {}
        if chunk_size is not None:
            config["chunk_size"] = chunk_size
        if chunk_overlap is not None:
            config["chunk_overlap"] = chunk_overlap
        if config:
            body["configuration"] = config
        data = self._client._post(f"{KB_PATH}/{quote(kb_id, safe='')}/documents", body, options=options)
        return AddDocumentResponse(**data)

    async def add_async(
        self,
        kb_id: str,
        *,
        content: str,
        key: str | None = None,
        metadata: dict[str, Any] | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        options: RequestOptions | None = None,
    ) -> AddDocumentResponse:
        body: dict[str, Any] = {"content": content}
        if key is not None:
            body["key"] = key
        if metadata is not None:
            body["metadata"] = metadata
        config: dict[str, Any] = {}
        if chunk_size is not None:
            config["chunk_size"] = chunk_size
        if chunk_overlap is not None:
            config["chunk_overlap"] = chunk_overlap
        if config:
            body["configuration"] = config
        data = await self._client._post_async(f"{KB_PATH}/{quote(kb_id, safe='')}/documents", body, options=options)
        return AddDocumentResponse(**data)

    def query(
        self,
        kb_id: str,
        *,
        query: str,
        prefilter_limit: int | None = None,
        top_k: int | None = None,
        filters: list[dict[str, Any]] | None = None,
        rerank: bool | None = None,
        parent_span_id: str | None = None,
        options: RequestOptions | None = None,
    ) -> list[QueryResult]:
        body: dict[str, Any] = {"query": query}
        if prefilter_limit is not None:
            body["prefilter_limit"] = prefilter_limit
        if top_k is not None:
            body["top_k"] = top_k
        if filters is not None:
            body["filters"] = filters
        if rerank is not None:
            body["rerank"] = rerank
        if parent_span_id is not None:
            body["parent_span_id"] = parent_span_id
        data = self._client._post(f"{KB_PATH}/{quote(kb_id, safe='')}/query", body, options=options)
        if isinstance(data, list):
            return [QueryResult(**r) for r in data]
        return []

    async def query_async(
        self,
        kb_id: str,
        *,
        query: str,
        prefilter_limit: int | None = None,
        top_k: int | None = None,
        filters: list[dict[str, Any]] | None = None,
        rerank: bool | None = None,
        parent_span_id: str | None = None,
        options: RequestOptions | None = None,
    ) -> list[QueryResult]:
        body: dict[str, Any] = {"query": query}
        if prefilter_limit is not None:
            body["prefilter_limit"] = prefilter_limit
        if top_k is not None:
            body["top_k"] = top_k
        if filters is not None:
            body["filters"] = filters
        if rerank is not None:
            body["rerank"] = rerank
        if parent_span_id is not None:
            body["parent_span_id"] = parent_span_id
        data = await self._client._post_async(f"{KB_PATH}/{quote(kb_id, safe='')}/query", body, options=options)
        if isinstance(data, list):
            return [QueryResult(**r) for r in data]
        return []

    def get_document(self, kb_id: str, key: str, *, options: RequestOptions | None = None) -> GetDocumentResponse:
        data = self._client._get(f"{KB_PATH}/{quote(kb_id, safe='')}/documents/{quote(key, safe='')}", options=options)
        return GetDocumentResponse(**data)

    async def get_document_async(
        self, kb_id: str, key: str, *, options: RequestOptions | None = None
    ) -> GetDocumentResponse:
        data = await self._client._get_async(
            f"{KB_PATH}/{quote(kb_id, safe='')}/documents/{quote(key, safe='')}", options=options
        )
        return GetDocumentResponse(**data)

    def delete_documents(
        self,
        kb_id: str,
        *,
        filters: list[dict[str, Any]] | None = None,
        options: RequestOptions | None = None,
    ) -> DeleteDocumentsResponse:
        body: dict[str, Any] = {}
        if filters is not None:
            body["filters"] = filters
        data = self._client._delete(f"{KB_PATH}/{quote(kb_id, safe='')}/documents", body=body, options=options)
        return DeleteDocumentsResponse(**(data or {}))

    async def delete_documents_async(
        self,
        kb_id: str,
        *,
        filters: list[dict[str, Any]] | None = None,
        options: RequestOptions | None = None,
    ) -> DeleteDocumentsResponse:
        body: dict[str, Any] = {}
        if filters is not None:
            body["filters"] = filters
        data = await self._client._delete_async(
            f"{KB_PATH}/{quote(kb_id, safe='')}/documents", body=body, options=options
        )
        return DeleteDocumentsResponse(**(data or {}))

    # --- File Operations ------------------------------------------------------

    def upload_file(
        self,
        kb_id: str,
        file: Any,
        *,
        filename: str | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> UploadFileResponse:
        fields: dict[str, str] = {}
        if chunk_size is not None:
            fields["chunkSize"] = str(chunk_size)
        if chunk_overlap is not None:
            fields["chunkOverlap"] = str(chunk_overlap)
        if metadata is not None:
            import json

            fields["metadata"] = json.dumps(metadata)
        data = self._client._upload(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/upload",
            file,
            filename=filename,
            fields=fields,
            options=options,
        )
        return UploadFileResponse(**data)

    async def upload_file_async(
        self,
        kb_id: str,
        file: Any,
        *,
        filename: str | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> UploadFileResponse:
        fields: dict[str, str] = {}
        if chunk_size is not None:
            fields["chunkSize"] = str(chunk_size)
        if chunk_overlap is not None:
            fields["chunkOverlap"] = str(chunk_overlap)
        if metadata is not None:
            import json

            fields["metadata"] = json.dumps(metadata)
        data = await self._client._upload_async(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/upload",
            file,
            filename=filename,
            fields=fields,
            options=options,
        )
        return UploadFileResponse(**data)

    def get_upload_url(
        self, kb_id: str, *, filename: str, options: RequestOptions | None = None
    ) -> GetUploadUrlResponse:
        data = self._client._post(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/upload-url",
            {"filename": filename},
            options=options,
        )
        return GetUploadUrlResponse(**data)

    async def get_upload_url_async(
        self, kb_id: str, *, filename: str, options: RequestOptions | None = None
    ) -> GetUploadUrlResponse:
        data = await self._client._post_async(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/upload-url",
            {"filename": filename},
            options=options,
        )
        return GetUploadUrlResponse(**data)

    def register_file(
        self,
        kb_id: str,
        *,
        filename: str,
        file_id: str,
        content_type: str,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> RegisterFileUploadResponse:
        body: dict[str, Any] = {"filename": filename, "file_id": file_id, "content_type": content_type}
        config: dict[str, Any] = {}
        if chunk_size is not None:
            config["chunk_size"] = chunk_size
        if chunk_overlap is not None:
            config["chunk_overlap"] = chunk_overlap
        if config:
            body["configuration"] = config
        if metadata is not None:
            body["metadata"] = metadata
        data = self._client._post(f"{KB_PATH}/{quote(kb_id, safe='')}/files/register", body, options=options)
        return RegisterFileUploadResponse(**data)

    async def register_file_async(
        self,
        kb_id: str,
        *,
        filename: str,
        file_id: str,
        content_type: str,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        metadata: dict[str, Any] | None = None,
        options: RequestOptions | None = None,
    ) -> RegisterFileUploadResponse:
        body: dict[str, Any] = {"filename": filename, "file_id": file_id, "content_type": content_type}
        config: dict[str, Any] = {}
        if chunk_size is not None:
            config["chunk_size"] = chunk_size
        if chunk_overlap is not None:
            config["chunk_overlap"] = chunk_overlap
        if config:
            body["configuration"] = config
        if metadata is not None:
            body["metadata"] = metadata
        data = await self._client._post_async(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/register", body, options=options
        )
        return RegisterFileUploadResponse(**data)

    def list_files(
        self,
        kb_id: str,
        *,
        offset: int | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> list[FileInfo]:
        query: dict[str, Any] = {}
        if offset is not None:
            query["offset"] = offset
        if limit is not None:
            query["limit"] = limit
        data = self._client._get(f"{KB_PATH}/{quote(kb_id, safe='')}/files", query=query, options=options)
        return [FileInfo(**f) for f in (data or {}).get("data", [])]

    async def list_files_async(
        self,
        kb_id: str,
        *,
        offset: int | None = None,
        limit: int | None = None,
        options: RequestOptions | None = None,
    ) -> list[FileInfo]:
        query: dict[str, Any] = {}
        if offset is not None:
            query["offset"] = offset
        if limit is not None:
            query["limit"] = limit
        data = await self._client._get_async(f"{KB_PATH}/{quote(kb_id, safe='')}/files", query=query, options=options)
        return [FileInfo(**f) for f in (data or {}).get("data", [])]

    def get_download_url(self, kb_id: str, file_id: str, *, options: RequestOptions | None = None) -> str:
        data = self._client._get(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/{quote(file_id, safe='')}/download-url",
            options=options,
        )
        return (data or {}).get("url", "")

    async def get_download_url_async(self, kb_id: str, file_id: str, *, options: RequestOptions | None = None) -> str:
        data = await self._client._get_async(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/{quote(file_id, safe='')}/download-url",
            options=options,
        )
        return (data or {}).get("url", "")

    def delete_file(self, kb_id: str, file_id: str, *, options: RequestOptions | None = None) -> None:
        self._client._delete(f"{KB_PATH}/{quote(kb_id, safe='')}/files/{quote(file_id, safe='')}", options=options)

    async def delete_file_async(self, kb_id: str, file_id: str, *, options: RequestOptions | None = None) -> None:
        await self._client._delete_async(
            f"{KB_PATH}/{quote(kb_id, safe='')}/files/{quote(file_id, safe='')}", options=options
        )
