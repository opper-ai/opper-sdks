"""Tests for ModelsClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import ModelInfo, ModelsResponse


class TestModels:
    def test_list(self, opper: Opper) -> None:
        opper._client._get.return_value = {
            "models": [
                {
                    "id": "m1",
                    "name": "GPT-4",
                    "type": "chat",
                    "provider": "openai",
                    "provider_display_name": "OpenAI",
                    "model_id": "gpt-4",
                    "description": "A model",
                    "capabilities": ["chat", "function_calling"],
                    "speed": "medium",
                    "quality": "high",
                    "cost": 0.03,
                    "context_window": 8192,
                    "params": {},
                    "pricing": {},
                    "region": "us",
                    "country": "US",
                    "api_type": "chat",
                },
            ]
        }
        result = opper.models.list()
        assert isinstance(result, ModelsResponse)
        assert len(result.models) == 1
        assert isinstance(result.models[0], ModelInfo)
        assert result.models[0].name == "GPT-4"

    def test_list_with_filters(self, opper: Opper) -> None:
        opper._client._get.return_value = {"models": []}
        opper.models.list(type="chat", provider="openai", capability="function_calling", limit=10)
        call_kwargs = opper._client._get.call_args
        query = call_kwargs.kwargs["query"]
        assert query["type"] == "chat"
        assert query["provider"] == "openai"
        assert query["capability"] == "function_calling"
        assert query["limit"] == 10

    async def test_list_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"models": [{"id": "m1", "name": "M"}]}
        result = await opper.models.list_async()
        assert len(result.models) == 1
