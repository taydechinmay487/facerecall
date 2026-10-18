from __future__ import annotations

from tests.conftest import create_person


def test_health_and_status(client):
    health = client.get("/api/v1/health").json()
    assert health["status"] == "ok"
    assert health["database"] == "ok"

    status = client.get("/api/v1/status").json()
    assert status["app_version"]
    assert status["single_user"] is True
    assert status["privacy"]["raw_images_retained"] is False
    assert status["privacy"]["camera_video_retained"] is False
    assert "engine" in status


def test_dashboard_counts_come_from_records(client):
    empty = client.get("/api/v1/dashboard").json()
    assert empty["total_people"] == 0
    assert empty["first_use"] is True

    person = create_person(client)
    client.post("/api/v1/interactions", json={"person_profile_id": person["id"]})
    summary = client.get("/api/v1/dashboard").json()
    assert summary["total_people"] == 1
    assert summary["total_interactions"] == 1
    assert summary["interactions_last_30_days"] == 1
    assert summary["first_use"] is False
    assert summary["recent_people"][0]["name"] == "Maya Rodrigues"


def test_export_contains_profile_and_warning(client):
    create_person(client)
    response = client.get("/api/v1/export")
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    body = response.json()
    assert "biometric" in body["warning"].lower()
    assert body["people"][0]["name"] == "Maya Rodrigues"
    assert body["settings"]["recognition_threshold"] == 0.45


def test_delete_all_requires_exact_confirmation(client):
    create_person(client)
    response = client.request(
        "DELETE", "/api/v1/data", json={"confirm_text": "delete all"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "confirmation_required"
    assert client.get("/api/v1/people").json()["total"] == 1


def test_delete_all_clears_records_and_settings(client):
    person = create_person(client)
    client.post("/api/v1/interactions", json={"person_profile_id": person["id"]})
    client.patch("/api/v1/settings", json={"recognition_threshold": 0.7})

    response = client.request("DELETE", "/api/v1/data", json={"confirm_text": "DELETE ALL"})
    assert response.status_code == 200
    body = response.json()
    assert body["deleted_people"] == 1
    assert body["deleted_interactions"] == 1

    assert client.get("/api/v1/people").json()["total"] == 0
    assert client.get("/api/v1/settings").json()["recognition_threshold"] == 0.45


def test_openapi_document_is_available(client):
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/people" in paths
    assert "/api/v1/recognition/match" in paths
