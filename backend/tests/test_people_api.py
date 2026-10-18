from __future__ import annotations

import pytest

from tests.conftest import create_person


def test_requires_consent(client):
    response = client.post(
        "/api/v1/people",
        json={"name": "Alex", "consent_confirmed": False},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert any("Consent" in field["message"] for field in body["error"]["details"]["fields"])


def test_blank_name_rejected(client):
    response = client.post("/api/v1/people", json={"name": "   ", "consent_confirmed": True})
    assert response.status_code == 422


def test_create_and_read_profile(client):
    person = create_person(client)
    assert person["name"] == "Maya Rodrigues"
    assert person["consent_status"] is True
    assert person["consent_recorded_at"] is not None
    assert person["enrollment_count"] == 0
    assert person["context_fields_completed"] == 4

    response = client.get(f"/api/v1/people/{person['id']}")
    assert response.status_code == 200
    assert response.json()["where_met"] == "Community garden"


def test_list_search_and_sort(client):
    create_person(client, name="Zara Bell", relationship="Colleague")
    create_person(client, name="Adam Cole", relationship="Neighbour")

    listing = client.get("/api/v1/people").json()
    assert listing["total"] == 2
    assert [item["name"] for item in listing["items"]] == ["Adam Cole", "Zara Bell"]
    assert set(listing["relationships"]) == {"Colleague", "Neighbour"}

    filtered = client.get("/api/v1/people", params={"q": "zara"}).json()
    assert filtered["total"] == 1

    by_relationship = client.get("/api/v1/people", params={"relationship": "Colleague"}).json()
    assert by_relationship["total"] == 1


def test_update_profile(client):
    person = create_person(client)
    response = client.patch(
        f"/api/v1/people/{person['id']}",
        json={"relationship": "Friend", "notes": "Met through the garden club."},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["relationship"] == "Friend"
    assert updated["name"] == "Maya Rodrigues"


def test_consent_cannot_be_edited_silently(client):
    person = create_person(client)
    response = client.patch(
        f"/api/v1/people/{person['id']}", json={"consent_status": False}
    )
    assert response.status_code == 422
    assert client.get(f"/api/v1/people/{person['id']}").json()["consent_status"] is True


def test_delete_profile_removes_interactions(client):
    person = create_person(client)
    created = client.post(
        "/api/v1/interactions",
        json={"person_profile_id": person["id"], "user_note": "Coffee"},
    )
    assert created.status_code == 201

    deleted = client.delete(f"/api/v1/people/{person['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted_interactions"] == 1
    assert client.get(f"/api/v1/people/{person['id']}").status_code == 404
    assert client.get("/api/v1/interactions").json()["total"] == 0


def test_missing_profile_returns_structured_404(client):
    response = client.get("/api/v1/people/9999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "person_not_found"


def test_unknown_fields_are_ignored_by_schema(client):
    response = client.post(
        "/api/v1/people",
        json={"name": "Sam", "consent_confirmed": True, "unexpected": "value"},
    )
    assert response.status_code == 201


@pytest.mark.parametrize("field", ["name", "relationship", "notes"])
def test_long_values_rejected(client, field):
    value = "x" * 5000
    response = client.post(
        "/api/v1/people", json={"name": "Long", "consent_confirmed": True, field: value}
    )
    assert response.status_code == 422
