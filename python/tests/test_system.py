"""Tests for SystemClient."""

from __future__ import annotations

from opperai._client import Opper
from opperai.types import HealthResponse


class TestSystem:
    def test_health(self, opper: Opper) -> None:
        opper._client._get.return_value = {"status": "ok"}
        result = opper.system.health()
        assert isinstance(result, HealthResponse)
        assert result.status == "ok"

    async def test_health_async(self, opper: Opper) -> None:
        opper._client._get_async.return_value = {"status": "ok"}
        result = await opper.system.health_async()
        assert result.status == "ok"
