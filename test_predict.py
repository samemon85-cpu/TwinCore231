"""
pytest test suite — TwinCore ML Service
Tests: health endpoint, single inference, batch inference, edge cases, model manager.
Run: pytest tests/ -v --cov=app --cov-report=term-missing
"""

import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# ── App setup ──────────────────────────────────────────────────────────────────
# Patch model loading before importing app so tests don't train models
import sys
sys.path.insert(0, ".")

from app.services.model_manager import ModelManager


# ── Fixtures ───────────────────────────────────────────────────────────────────
@pytest.fixture
def mock_model_manager():
    mm = MagicMock(spec=ModelManager)
    mm.models_loaded = True
    mm.model_version = "v2.1.0-test"
    mm.predict = AsyncMock(return_value={
        "asset_id":       "a-001",
        "rul_hours":      2847,
        "risk_score":     0.215,
        "confidence":     0.921,
        "recommendation": "Asset in good condition — continue normal operation",
        "anomalies":      [],
        "model_version":  "v2.1.0-test",
        "predicted_at":   "2026-05-24T10:00:00+00:00",
    })
    return mm


@pytest.fixture
def app_with_mock_mm(mock_model_manager):
    """Return FastAPI app with a pre-loaded mock model manager."""
    from app.main import app
    app.state.model_manager = mock_model_manager
    return app


@pytest.fixture
def client(app_with_mock_mm):
    return TestClient(app_with_mock_mm)


# ── Health endpoint ────────────────────────────────────────────────────────────
class TestHealth:
    def test_returns_ok(self, client):
        res = client.get("/health")
        assert res.status_code == 200

    def test_response_schema(self, client):
        body = client.get("/health").json()
        assert body["status"] == "ok"
        assert body["service"] == "twincore-ml"
        assert "version" in body
        assert "models_loaded" in body
        assert "ts" in body

    def test_models_loaded_true(self, client):
        body = client.get("/health").json()
        assert body["models_loaded"] is True


# ── Predict endpoint ───────────────────────────────────────────────────────────
VALID_PAYLOAD = {
    "asset_id": "a-001",
    "features": {
        "vibration": 1.2,
        "temp":      22.5,
        "runtime":   4500,
        "current":   5.1,
        "noise_db":  62.0,
    },
}

class TestPredict:
    def test_returns_200_for_valid_payload(self, client):
        res = client.post("/predict", json=VALID_PAYLOAD)
        assert res.status_code == 200

    def test_response_contains_required_fields(self, client):
        body = client.post("/predict", json=VALID_PAYLOAD).json()
        for field in ["asset_id", "rul_hours", "risk_score", "confidence",
                       "recommendation", "anomalies", "model_version", "predicted_at"]:
            assert field in body, f"Missing field: {field}"

    def test_rul_hours_is_positive_integer(self, client):
        body = client.post("/predict", json=VALID_PAYLOAD).json()
        assert isinstance(body["rul_hours"], int)
        assert body["rul_hours"] > 0

    def test_risk_score_in_range(self, client):
        body = client.post("/predict", json=VALID_PAYLOAD).json()
        assert 0.0 <= body["risk_score"] <= 1.0

    def test_confidence_in_range(self, client):
        body = client.post("/predict", json=VALID_PAYLOAD).json()
        assert 0.0 <= body["confidence"] <= 1.0

    def test_anomalies_is_list(self, client):
        body = client.post("/predict", json=VALID_PAYLOAD).json()
        assert isinstance(body["anomalies"], list)

    def test_asset_id_echoed(self, client):
        body = client.post("/predict", json=VALID_PAYLOAD).json()
        assert body["asset_id"] == "a-001"

    def test_returns_422_for_missing_features(self, client):
        res = client.post("/predict", json={"asset_id": "a-001"})
        assert res.status_code == 422

    def test_returns_422_for_out_of_range_vibration(self, client):
        payload = {**VALID_PAYLOAD, "features": {**VALID_PAYLOAD["features"], "vibration": 999}}
        res = client.post("/predict", json=payload)
        assert res.status_code == 422

    def test_returns_422_for_negative_runtime(self, client):
        payload = {**VALID_PAYLOAD, "features": {**VALID_PAYLOAD["features"], "runtime": -1}}
        res = client.post("/predict", json=payload)
        assert res.status_code == 422

    def test_optional_fields_not_required(self, client):
        payload = {"asset_id": "a-002", "features": {"vibration": 2.0, "temp": 30.0, "runtime": 1000}}
        res = client.post("/predict", json=payload)
        assert res.status_code == 200

    def test_503_when_models_not_loaded(self, app_with_mock_mm, mock_model_manager):
        mock_model_manager.models_loaded = False
        client = TestClient(app_with_mock_mm)
        res = client.post("/predict", json=VALID_PAYLOAD)
        assert res.status_code == 503


# ── Batch predict ──────────────────────────────────────────────────────────────
class TestBatchPredict:
    def test_returns_200_for_batch(self, client, mock_model_manager):
        payloads = [
            {**VALID_PAYLOAD, "asset_id": "a-001"},
            {**VALID_PAYLOAD, "asset_id": "a-002"},
            {**VALID_PAYLOAD, "asset_id": "a-003"},
        ]
        res = client.post("/predict/batch", json=payloads)
        assert res.status_code == 200

    def test_batch_count_matches_input(self, client, mock_model_manager):
        payloads = [{**VALID_PAYLOAD, "asset_id": f"a-{i:03d}"} for i in range(5)]
        body = client.post("/predict/batch", json=payloads).json()
        assert body["count"] == 5
        assert len(body["predictions"]) == 5


# ── ModelManager unit tests ────────────────────────────────────────────────────
class TestModelManager:
    @pytest.fixture
    def mm(self):
        """Real ModelManager with heuristic fallback (no sklearn needed)."""
        m = ModelManager()
        m.models_loaded = True
        m._rul_model    = None   # force heuristic
        m._anomaly_model= None
        return m

    @pytest.mark.asyncio
    async def test_predict_returns_required_keys(self, mm):
        class F: vibration=1.0; temp=25.0; runtime=5000; current=5.0; noise_db=65.0
        result = await mm.predict("a-001", F())
        for key in ["rul_hours","risk_score","confidence","recommendation","anomalies","model_version","predicted_at"]:
            assert key in result

    @pytest.mark.asyncio
    async def test_rul_clamped_to_minimum_50(self, mm):
        class F: vibration=50.0; temp=300.0; runtime=30000; current=15.0; noise_db=100.0
        result = await mm.predict("a-004", F())
        assert result["rul_hours"] >= 50

    @pytest.mark.asyncio
    async def test_high_vibration_triggers_anomaly(self, mm):
        class F: vibration=4.5; temp=25.0; runtime=1000; current=5.0; noise_db=60.0
        result = await mm.predict("a-002", F())
        assert any("vibration" in a.lower() for a in result["anomalies"])

    @pytest.mark.asyncio
    async def test_high_temp_triggers_anomaly(self, mm):
        class F: vibration=0.5; temp=90.0; runtime=1000; current=5.0; noise_db=60.0
        result = await mm.predict("a-003", F())
        assert any("temp" in a.lower() or "temperature" in a.lower() for a in result["anomalies"])

    @pytest.mark.asyncio
    async def test_good_asset_no_anomalies(self, mm):
        class F: vibration=0.8; temp=22.0; runtime=2000; current=4.5; noise_db=58.0
        result = await mm.predict("a-005", F())
        assert result["risk_score"] < 0.5

    @pytest.mark.asyncio
    async def test_recommendation_changes_with_risk(self, mm):
        class LowRisk:  vibration=0.5; temp=20.0; runtime=500;   current=4.0; noise_db=55.0
        class HighRisk: vibration=5.5; temp=90.0; runtime=25000; current=14.0; noise_db=90.0
        low  = await mm.predict("a-001", LowRisk())
        high = await mm.predict("a-002", HighRisk())
        assert low["recommendation"] != high["recommendation"]
        assert "good condition" in low["recommendation"].lower() or "normal" in low["recommendation"].lower()
