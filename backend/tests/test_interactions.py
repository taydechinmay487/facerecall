from __future__ import annotations

from datetime import datetime, timedelta, timezone

from tests.conftest import create_person


def test_create_and_list_interaction(client):
    person = create_person(client)
    occurred = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    created = client.post(
        "/api/v1/interactions",
        json={
            "person_profile_id": person["id"],
            "occurred_at": occurred,
            "event_source": "recognition_assisted",
            "user_note": "Said hello at the garden gate.",
        },
    )
    assert created.status_code == 201, created.text
    entry = created.json()
    assert entry["person_name"] == "Maya Rodrigues"
    assert entry["event_source"] == "recognition_assisted"

    listing = client.get("/api/v1/interactions").json()
    assert listing["total"] == 1
    assert listing["items"][0]["user_note"] == "Said hello at the garden gate."


def test_last_confirmed_interaction_is_reflected_on_profile(client):
    person = create_person(client)
    client.post(
        "/api/v1/interactions",
        json={"person_profile_id": person["id"], "user_note": "Coffee"},
    )
    detail = client.get(f"/api/v1/people/{person['id']}").json()
    assert detail["last_confirmed_interaction_at"] is not None


def test_interaction_requires_existing_person(client):
    response = client.post("/api/v1/interactions", json={"person_profile_id": 12345})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "person_not_found"


def test_interaction_filters(client):
    first = create_person(client, name="First Person")
    second = create_person(client, name="Second Person")

    old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent = datetime.now(timezone.utc).isoformat()
    client.post("/api/v1/interactions", json={"person_profile_id": first["id"], "occurred_at": old})
    client.post(
        "/api/v1/interactions", json={"person_profile_id": second["id"], "occurred_at": recent}
    )

    by_person = client.get("/api/v1/interactions", params={"person_id": second["id"]}).json()
    assert by_person["total"] == 1

    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_only = client.get("/api/v1/interactions", params={"start": since}).json()
    assert recent_only["total"] == 1
    assert recent_only["items"][0]["person_name"] == "Second Person"


def test_update_and_delete_interaction(client):
    person = create_person(client)
    entry = client.post(
        "/api/v1/interactions",
        json={"person_profile_id": person["id"], "user_note": "Typo"},
    ).json()

    updated = client.patch(
        f"/api/v1/interactions/{entry['id']}",
        json={"user_note": "Corrected note", "confirmation_status": "corrected"},
    )
    assert updated.status_code == 200
    assert updated.json()["user_note"] == "Corrected note"

    deleted = client.delete(f"/api/v1/interactions/{entry['id']}")
    assert deleted.status_code == 200
    assert client.get("/api/v1/interactions").json()["total"] == 0


def test_missing_interaction_returns_404(client):
    assert client.patch("/api/v1/interactions/999", json={"user_note": "x"}).status_code == 404
    assert client.delete("/api/v1/interactions/999").status_code == 404


def test_demo_profiles_reject_interactions(client):
    client.post("/api/v1/demo/seed")
    demo = client.get("/api/v1/people", params={"dataset": "demo"}).json()
    assert demo["total"] == 4
    demo_id = demo["items"][0]["id"]

    response = client.post("/api/v1/interactions", json={"person_profile_id": demo_id})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "demo_read_only"


def test_demo_people_are_excluded_from_real_list(client):
    client.post("/api/v1/demo/seed")
    create_person(client, name="Real Person")
    real = client.get("/api/v1/people").json()
    assert real["total"] == 1
    assert real["items"][0]["name"] == "Real Person"
    assert client.get("/api/v1/people", params={"dataset": "demo"}).json()["total"] == 4


def test_demo_recognition_is_labelled_simulated(client):
    client.post("/api/v1/demo/seed")
    result = client.post("/api/v1/recognition/demo").json()
    assert result["decision"] == "accepted_match"
    assert result["mode"] == "demo"
    assert result["is_simulated"] is True
    assert result["model_name"] == "demo-synthetic"


def test_demo_recognition_without_seed(client):
    response = client.post("/api/v1/recognition/demo")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "demo_not_seeded"
