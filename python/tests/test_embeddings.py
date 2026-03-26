"""Tests for EmbeddingsClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import EmbeddingsResponse


class TestEmbeddings:
    def test_create(self, opper: Opper) -> None:
        opper._client._post.return_value = {
            "object": "list",
            "data": [
                {"object": "embedding", "index": 0, "embedding": [0.1, 0.2, 0.3]},
            ],
            "model": "text-embedding-ada-002",
            "usage": {"prompt_tokens": 5, "total_tokens": 5},
        }
        result = opper.embeddings.create(input="hello", model="text-embedding-ada-002")
        assert isinstance(result, EmbeddingsResponse)
        assert result.model == "text-embedding-ada-002"
        assert len(result.data) == 1
        assert result.data[0].embedding == [0.1, 0.2, 0.3]
        assert result.usage.prompt_tokens == 5

    def test_create_with_list_input(self, opper: Opper) -> None:
        opper._client._post.return_value = {
            "object": "list",
            "data": [
                {"object": "embedding", "index": 0, "embedding": [0.1]},
                {"object": "embedding", "index": 1, "embedding": [0.2]},
            ],
            "model": "model",
            "usage": {"prompt_tokens": 10, "total_tokens": 10},
        }
        result = opper.embeddings.create(input=["hello", "world"], model="model")
        assert len(result.data) == 2

    def test_create_with_optional_params(self, opper: Opper) -> None:
        opper._client._post.return_value = {"object": "list", "data": [], "model": "m", "usage": {}}
        opper.embeddings.create(input="hi", model="m", dimensions=256, encoding_format="float", user="u1")
        body = opper._client._post.call_args[0][1]
        assert body["dimensions"] == 256
        assert body["encoding_format"] == "float"
        assert body["user"] == "u1"

    async def test_create_async(self, opper: Opper) -> None:
        opper._client._post_async.return_value = {
            "object": "list",
            "data": [{"object": "embedding", "index": 0, "embedding": [0.5]}],
            "model": "m",
            "usage": {"prompt_tokens": 1, "total_tokens": 1},
        }
        result = await opper.embeddings.create_async(input="hi", model="m")
        assert len(result.data) == 1
