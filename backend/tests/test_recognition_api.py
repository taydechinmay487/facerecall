from __future__ import annotations

import numpy as np
import pytest

from app.recognition.engine_base import EngineUnavailable
from tests.conftest import create_person


@pytest.fixture()
def stub(monkeypatch, engine):
    monkeypatch.setattr("app.recognition.pipeline.get_engine", lambda: engine)
    monkeypatch.setattr("app.services.enrollment_service.get_engine", lambda: engine)
    return engine


def enroll(client, person_id: int, jpeg_bytes: bytes):
    return client.post(
        f"/api/v1/people/{person_id}/enroll",
        files={"file": ("face.jpg", jpeg_bytes, "image/jpeg")},
    )


def match(client, jpeg_bytes: bytes, name: str = "frame.jpg", content_type: str = "image/jpeg"):
    return client.post(
        "/api/v1/recognition/match",
        files={"file": (name, jpeg_bytes, content_type)},
    )


def test_enrolment_stores_embedding_and_metadata(client, stub, jpeg_bytes):
    person = create_person(client)
    response = enroll(client, person["id"], jpeg_bytes)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["enrollment"]["embedding_dim"] == 128
    assert body["enrollment"]["model_name"] == "SFace"
    assert body["person"]["enrollment_count"] == 1


def test_enrolment_requires_consent(client, stub, jpeg_bytes):
    person = create_person(client)
    client.post(f"/api/v1/people/{person['id']}/consent/withdraw")
    response = enroll(client, person["id"], jpeg_bytes)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "consent_required"


def test_withdrawing_consent_deletes_biometric_records(client, stub, jpeg_bytes):
    person = create_person(client)
    assert enroll(client, person["id"], jpeg_bytes).status_code == 201
    withdrawn = client.post(f"/api/v1/people/{person['id']}/consent/withdraw")
    assert withdrawn.status_code == 200
    assert withdrawn.json()["enrollments_deleted"] == 1

    detail = client.get(f"/api/v1/people/{person['id']}").json()
    assert detail["consent_status"] is False
    assert detail["enrollments"] == []

    second = client.post(f"/api/v1/people/{person['id']}/consent/withdraw")
    assert second.status_code == 409


def test_enrolment_rejects_photo_without_face(client, stub, jpeg_bytes):
    stub.faces = 0
    person = create_person(client)
    response = enroll(client, person["id"], jpeg_bytes)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "no_face_detected"


def test_enrolment_rejects_multiple_faces(client, stub, jpeg_bytes):
    stub.faces = 2
    person = create_person(client)
    response = enroll(client, person["id"], jpeg_bytes)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "multiple_faces_detected"


def test_enrolment_limit(client, stub, jpeg_bytes):
    person = create_person(client)
    vectors = [0, 1, 2]
    for index in vectors:
        stub.vector = np.zeros(128, dtype=np.float32)
        stub.vector[index] = 1.0
        assert enroll(client, person["id"], jpeg_bytes).status_code == 201
    response = enroll(client, person["id"], jpeg_bytes)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "enrollment_limit"


def test_duplicate_enrolment_is_rejected(client, stub, jpeg_bytes):
    person = create_person(client)
    assert enroll(client, person["id"], jpeg_bytes).status_code == 201
    duplicate = enroll(client, person["id"], jpeg_bytes)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_photo"


def test_accepted_match_returns_context(client, stub, jpeg_bytes):
    person = create_person(client)
    assert enroll(client, person["id"], jpeg_bytes).status_code == 201

    response = match(client, jpeg_bytes)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["decision"] == "accepted_match"
    assert result["person"]["name"] == "Maya Rodrigues"
    assert result["person"]["relationship"] == "Neighbour"
    assert result["person"]["where_met"] == "Community garden"
    assert result["mode"] == "real"
    assert result["is_simulated"] is False


def test_match_does_not_record_history_automatically(client, stub, jpeg_bytes):
    person = create_person(client)
    enroll(client, person["id"], jpeg_bytes)
    match(client, jpeg_bytes)
    assert client.get("/api/v1/interactions").json()["total"] == 0


def test_unknown_person_when_nothing_matches(client, stub, jpeg_bytes):
    person = create_person(client)
    enroll(client, person["id"], jpeg_bytes)

    stub.vector = np.zeros(128, dtype=np.float32)
    stub.vector[5] = 1.0
    result = match(client, jpeg_bytes).json()
    assert result["decision"] == "unknown_person"
    assert result["person"] is None


def test_unknown_when_no_profiles_enrolled(client, stub, jpeg_bytes):
    result = match(client, jpeg_bytes).json()
    assert result["decision"] == "unknown_person"


def test_not_confident_between_two_close_profiles(client, stub, jpeg_bytes):
    base = np.zeros(128, dtype=np.float32)
    base[0] = 1.0
    near = base.copy()
    near[1] = 0.001

    first = create_person(client, name="Alex One")
    stub.vector = base
    assert enroll(client, first["id"], jpeg_bytes).status_code == 201

    second = create_person(client, name="Alex Two")
    stub.vector = near
    assert enroll(client, second["id"], jpeg_bytes).status_code == 201

    stub.vector = base
    result = match(client, jpeg_bytes).json()
    assert result["decision"] == "not_confident"
    assert result["person"] is None


def test_no_face_in_frame(client, stub, jpeg_bytes):
    stub.faces = 0
    result = match(client, jpeg_bytes).json()
    assert result["decision"] == "no_face_detected"
    assert result["guidance"]


def test_multiple_faces_in_frame(client, stub, jpeg_bytes):
    stub.faces = 2
    result = match(client, jpeg_bytes).json()
    assert result["decision"] == "multiple_faces_detected"
    assert result["person"] is None


def test_corrupt_image_is_a_safe_failure(client, stub):
    response = match(client, b"this is not an image", name="bad.jpg")
    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "processing_error"
    assert body["person"] is None


def test_blurry_image_is_rejected(client, stub):
    import cv2

    flat = np.full((320, 320, 3), 128, dtype=np.uint8)
    ok, buffer = cv2.imencode(".jpg", flat)
    assert ok
    body = match(client, buffer.tobytes()).json()
    assert body["decision"] == "processing_error"
    assert "blur" in body["explanation"].lower()


def test_unsupported_content_type_is_rejected(client, stub, jpeg_bytes):
    response = match(client, jpeg_bytes, name="face.gif", content_type="image/gif")
    assert response.status_code == 200
    assert response.json()["decision"] == "processing_error"


def test_engine_unavailable_returns_503(client, stub, jpeg_bytes, monkeypatch):
    def boom(_image):
        raise EngineUnavailable("Face models are not installed.")

    monkeypatch.setattr(stub, "detect", boom)
    response = match(client, jpeg_bytes)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "engine_unavailable"


def test_remove_enrolment(client, stub, jpeg_bytes):
    person = create_person(client)
    created = enroll(client, person["id"], jpeg_bytes).json()
    enrollment_id = created["enrollment"]["id"]
    response = client.delete(
        f"/api/v1/people/{person['id']}/enrollments/{enrollment_id}"
    )
    assert response.status_code == 200
    detail = client.get(f"/api/v1/people/{person['id']}").json()
    assert detail["enrollments"] == []
