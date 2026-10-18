from __future__ import annotations

import numpy as np

from tests.conftest import StubEngine, create_person


def test_default_settings(client):
    body = client.get("/api/v1/settings").json()
    assert body["recognition_threshold"] == 0.45
    assert body["ambiguity_margin"] == 0.05
    assert body["voice_enabled"] is False
    assert body["speech_rate"] == 1.0


def test_update_settings(client):
    response = client.patch(
        "/api/v1/settings",
        json={"recognition_threshold": 0.52, "voice_enabled": True, "speech_rate": 1.2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["recognition_threshold"] == 0.52
    assert body["voice_enabled"] is True

    assert client.get("/api/v1/settings").json()["recognition_threshold"] == 0.52


def test_invalid_settings_rejected(client):
    assert client.patch("/api/v1/settings", json={"recognition_threshold": 1.4}).status_code == 422
    assert client.patch("/api/v1/settings", json={"ambiguity_margin": -0.2}).status_code == 422
    assert client.patch("/api/v1/settings", json={"speech_rate": 9}).status_code == 422
    assert client.patch("/api/v1/settings", json={"frame_interval_ms": 10}).status_code == 422


def test_settings_threshold_is_used_for_matching(client, monkeypatch, jpeg_bytes):
    engine = StubEngine()
    monkeypatch.setattr("app.recognition.pipeline.get_engine", lambda: engine)
    monkeypatch.setattr("app.services.enrollment_service.get_engine", lambda: engine)

    person = create_person(client)
    enrolled = client.post(
        f"/api/v1/people/{person['id']}/enroll",
        files={"file": ("face.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert enrolled.status_code == 201

    # Raise the threshold above the similarity this frame will produce.
    client.patch(
        "/api/v1/settings", json={"recognition_threshold": 0.99, "ambiguity_margin": 0}
    )
    query = np.zeros(128, dtype=np.float32)
    query[0] = 0.5
    query[1] = 0.5
    engine.vector = query

    result = client.post(
        "/api/v1/recognition/match",
        files={"file": ("frame.jpg", jpeg_bytes, "image/jpeg")},
    ).json()
    assert result["decision"] == "unknown_person"
    assert result["diagnostics"]["threshold"] == 0.99


def test_diagnostics_reports_engine_state(client):
    body = client.get("/api/v1/settings/diagnostics").json()
    assert "engine" in body
    assert "thresholds" in body
    assert "not probabilities" in body["note"]
