from __future__ import annotations

import pytest
from cryptography.fernet import Fernet

from app.core import crypto
from app.core.config import get_settings
from app.services import thumbnails
from tests.conftest import create_person


@pytest.fixture()
def encryption_key(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("FACERECALL_ENCRYPTION_KEY", key)
    get_settings.cache_clear()
    crypto.reset_cache()
    yield key
    monkeypatch.delenv("FACERECALL_ENCRYPTION_KEY", raising=False)
    get_settings.cache_clear()
    crypto.reset_cache()


def test_embeddings_are_encrypted_when_key_is_set(encryption_key):
    raw = b"\x00\x01\x02" * 64
    protected = crypto.protect_bytes(raw)
    assert protected.startswith(b"enc:v1:")
    assert raw not in protected
    assert crypto.reveal_bytes(protected) == raw
    assert crypto.encryption_enabled() is True


def test_plain_storage_when_no_key(data_dir):
    raw = b"plain"
    assert crypto.protect_bytes(raw) == raw
    assert crypto.reveal_bytes(raw) == raw
    assert crypto.encryption_enabled() is False


def test_invalid_key_raises_clear_error(monkeypatch):
    monkeypatch.setenv("FACERECALL_ENCRYPTION_KEY", "not-a-key")
    get_settings.cache_clear()
    crypto.reset_cache()
    with pytest.raises(crypto.EncryptionError):
        crypto.protect_bytes(b"value")
    monkeypatch.delenv("FACERECALL_ENCRYPTION_KEY", raising=False)
    get_settings.cache_clear()
    crypto.reset_cache()


def test_thumbnail_paths_reject_traversal():
    assert thumbnails.thumbnail_path("../../etc/passwd") is None
    assert thumbnails.thumbnail_path("not-a-name.jpg") is None
    assert thumbnails.thumbnail_path(None) is None


def test_thumbnail_round_trip(data_dir):
    name = thumbnails.save_thumbnail(b"jpegdata")
    path = thumbnails.thumbnail_path(name)
    assert path is not None
    assert path.read_bytes() == b"jpegdata"
    assert thumbnails.delete_thumbnail(name) is True
    assert thumbnails.thumbnail_path(name) is None


def test_upload_size_limit(client, monkeypatch, jpeg_bytes):
    monkeypatch.setenv("FACERECALL_MAX_UPLOAD_BYTES", "500")
    get_settings.cache_clear()
    person = create_person(client)
    response = client.post(
        f"/api/v1/people/{person['id']}/enroll",
        files={"file": ("face.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


def test_api_never_returns_embedding_material(client, monkeypatch, jpeg_bytes):
    from tests.conftest import StubEngine

    engine = StubEngine()
    monkeypatch.setattr("app.services.enrollment_service.get_engine", lambda: engine)
    person = create_person(client)
    client.post(
        f"/api/v1/people/{person['id']}/enroll",
        files={"file": ("face.jpg", jpeg_bytes, "image/jpeg")},
    )
    payload = client.get(f"/api/v1/people/{person['id']}").json()
    enrollment = payload["enrollments"][0]
    # Only descriptive metadata is exposed; never the vector itself.
    assert set(enrollment) == {
        "id",
        "person_profile_id",
        "model_name",
        "model_version",
        "preprocessing_version",
        "embedding_dim",
        "quality_score",
        "has_thumbnail",
        "created_at",
        "is_demo",
    }
    raw = client.get(f"/api/v1/people/{person['id']}").text
    for forbidden in ("embedding_blob", "embedding_base64", "float32"):
        assert forbidden not in raw


def test_delete_removes_thumbnail_files(client, monkeypatch, jpeg_bytes, data_dir):
    from tests.conftest import StubEngine

    engine = StubEngine()
    monkeypatch.setattr("app.services.enrollment_service.get_engine", lambda: engine)
    person = create_person(client)
    client.post(
        f"/api/v1/people/{person['id']}/enroll",
        files={"file": ("face.jpg", jpeg_bytes, "image/jpeg")},
    )
    previews = list((data_dir / "thumbnails").glob("*.jpg"))
    assert len(previews) == 1

    client.delete(f"/api/v1/people/{person['id']}")
    assert list((data_dir / "thumbnails").glob("*.jpg")) == []
