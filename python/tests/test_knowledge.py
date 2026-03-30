"""Tests for KnowledgeClient."""

from __future__ import annotations

from io import BytesIO

from opperai._client import Opper
from opperai.types import (
    AddDocumentResponse,
    CreateKnowledgeBaseResponse,
    DeleteDocumentsResponse,
    GetDocumentResponse,
    GetKnowledgeBaseResponse,
    GetUploadUrlResponse,
    KnowledgeBaseInfo,
    QueryResult,
    RegisterFileUploadResponse,
    UploadFileResponse,
)


class TestKnowledgeBaseCRUD:
    def test_create(self, opper: Opper) -> None:
        opper._client._post.return_value = {"id": "kb1", "name": "my-kb", "created_at": "2024-01-01", "embedding_model": "default"}
        result = opper.knowledge.create(name="my-kb")
        assert isinstance(result, CreateKnowledgeBaseResponse)
        assert result.id == "kb1"

    def test_create_with_model(self, opper: Opper) -> None:
        opper._client._post.return_value = {"id": "kb1", "name": "kb", "created_at": "", "embedding_model": "custom"}
        opper.knowledge.create(name="kb", embedding_model="custom")
        body = opper._client._post.call_args[0][1]
        assert body["embedding_model"] == "custom"

    def test_list(self, opper: Opper) -> None:
        opper._client._get.return_value = {"data": [{"id": "kb1", "name": "kb", "created_at": "", "embedding_model": ""}]}
        result = opper.knowledge.list()
        assert len(result) == 1
        assert isinstance(result[0], KnowledgeBaseInfo)

    def test_get(self, opper: Opper) -> None:
        opper._client._get.return_value = {"id": "kb1", "name": "kb", "created_at": "", "embedding_model": "", "count": 42}
        result = opper.knowledge.get("kb1")
        assert isinstance(result, GetKnowledgeBaseResponse)
        assert result.count == 42

    def test_get_by_name(self, opper: Opper) -> None:
        opper._client._get.return_value = {"id": "kb1", "name": "my-kb", "created_at": "", "embedding_model": "", "count": 0}
        result = opper.knowledge.get_by_name("my-kb")
        assert result.name == "my-kb"

    def test_delete(self, opper: Opper) -> None:
        opper._client._delete.return_value = None
        opper.knowledge.delete("kb1")
        opper._client._delete.assert_called_once()

    async def test_create_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"id": "kb1", "name": "kb", "created_at": "", "embedding_model": ""}
        result = await opper.knowledge.create_async(name="kb")
        assert result.id == "kb1"


class TestKnowledgeDocuments:
    def test_add(self, opper: Opper) -> None:
        opper._client._post.return_value = {"id": "d1", "key": "doc-key"}
        result = opper.knowledge.add("kb1", content="hello world", key="doc-key")
        assert isinstance(result, AddDocumentResponse)
        assert result.key == "doc-key"

    def test_add_with_chunking(self, opper: Opper) -> None:
        opper._client._post.return_value = {"id": "d1", "key": "k"}
        opper.knowledge.add("kb1", content="text", chunk_size=500, chunk_overlap=50)
        body = opper._client._post.call_args[0][1]
        assert body["configuration"]["chunk_size"] == 500

    def test_query(self, opper: Opper) -> None:
        opper._client._post.return_value = [
            {"id": "d1", "key": "k1", "content": "hello", "metadata": {}, "score": 0.95},
        ]
        result = opper.knowledge.query("kb1", query="hello")
        assert len(result) == 1
        assert isinstance(result[0], QueryResult)
        assert result[0].score == 0.95

    def test_query_with_filters(self, opper: Opper) -> None:
        opper._client._post.return_value = []
        opper.knowledge.query("kb1", query="x", top_k=5, filters=[{"field": "type", "operation": "=", "value": "doc"}])
        body = opper._client._post.call_args[0][1]
        assert body["top_k"] == 5
        assert len(body["filters"]) == 1

    def test_get_document(self, opper: Opper) -> None:
        opper._client._get.return_value = {"id": "d1", "key": "k1", "segments": [{"id": "seg1", "content": "text"}]}
        result = opper.knowledge.get_document("kb1", "k1")
        assert isinstance(result, GetDocumentResponse)
        assert len(result.segments) == 1

    def test_delete_documents(self, opper: Opper) -> None:
        opper._client._delete.return_value = {"deleted_count": 3}
        result = opper.knowledge.delete_documents("kb1")
        assert isinstance(result, DeleteDocumentsResponse)
        assert result.deleted_count == 3

    async def test_add_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {"id": "d1", "key": "k"}
        result = await opper.knowledge.add_async("kb1", content="text")
        assert result.id == "d1"

    async def test_query_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = [{"id": "d1", "key": "k", "content": "x", "metadata": {}, "score": 0.9}]
        result = await opper.knowledge.query_async("kb1", query="x")
        assert len(result) == 1


class TestKnowledgeFiles:
    def test_upload_file(self, opper: Opper) -> None:
        opper._client._upload.return_value = {"id": "f1", "key": "k1", "original_filename": "test.txt", "document_id": 1}
        result = opper.knowledge.upload_file("kb1", BytesIO(b"content"), filename="test.txt")
        assert isinstance(result, UploadFileResponse)
        assert result.original_filename == "test.txt"

    def test_get_upload_url(self, opper: Opper) -> None:
        opper._client._get.return_value = {"url": "https://upload.example.com", "fields": {}, "id": "f1"}
        result = opper.knowledge.get_upload_url("kb1", filename="test.txt")
        assert isinstance(result, GetUploadUrlResponse)

    def test_register_file(self, opper: Opper) -> None:
        opper._client._post.return_value = {"id": "f1", "key": "k", "original_filename": "f.txt", "document_id": 1}
        result = opper.knowledge.register_file("kb1", filename="f.txt", file_id="fid", content_type="text/plain")
        assert isinstance(result, RegisterFileUploadResponse)

    def test_list_files(self, opper: Opper) -> None:
        opper._client._get.return_value = {"data": [{"id": "f1", "original_filename": "f.txt", "size": 100, "status": "ready", "document_id": 1, "metadata": {}}]}
        result = opper.knowledge.list_files("kb1")
        assert len(result) == 1

    def test_get_download_url(self, opper: Opper) -> None:
        opper._client._get.return_value = {"url": "https://download.example.com/file"}
        result = opper.knowledge.get_download_url("kb1", "f1")
        assert result == "https://download.example.com/file"

    def test_delete_file(self, opper: Opper) -> None:
        opper._client._delete.return_value = None
        opper.knowledge.delete_file("kb1", "f1")
        opper._client._delete.assert_called_once()

    async def test_upload_file_async(self, opper: Opper) -> None:
        opper._client._upload_async.return_value = {"id": "f1", "key": "k", "original_filename": "f.txt", "document_id": 1}
        result = await opper.knowledge.upload_file_async("kb1", BytesIO(b"data"), filename="f.txt")
        assert result.id == "f1"
