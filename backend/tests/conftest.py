"""Test fixtures: isolated SQLite database, temp data dir, stub face engine.

The stub engine lets the pipeline be tested deterministically without the
pretrained models: real model weights are never required for these tests.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("FACERECALL_ENABLE_RATE_LIMIT", "false")

from app import models  # noqa: E402,F401  (registers tables on the metadata)
from app.core.config import get_settings  # noqa: E402
from app.database.session import Base, get_db  # noqa: E402
from app.recognition.engine_base import (  # noqa: E402
    DetectedFace,
    EmbeddedFace,
    to_float32_vector,
)


class StubEngine:
    """Deterministic engine: one face per image, embedding from `vector_for`."""

    name = "SFace"
    detector_name = "YuNet"
    version = "2021dec"
    preprocessing_version = "yunet-2023mar+sface-align-v1"
    embedding_dim = 128
    similarity_metric = "cosine"
    models_present = True

    def __init__(self) -> None:
        self.faces: int = 1
        self.vector = np.zeros(128, dtype=np.float32)
        self.vector[0] = 1.0

    @property
    def ready(self) -> bool:
        return True

    def load(self) -> None:  # pragma: no cover - no-op
        return None

    def detect(self, image: np.ndarray) -> list[DetectedFace]:
        return [
            DetectedFace(box=(10, 10, 80, 80), confidence=0.99, payload=None)
            for _ in range(self.faces)
        ]

    def embed(self, image: np.ndarray, face: DetectedFace) -> EmbeddedFace:
        return EmbeddedFace(vector=to_float32_vector(self.vector), quality=0.98)


@pytest.fixture()
def engine() -> StubEngine:
    return StubEngine()


@pytest.fixture()
def data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("FACERECALL_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("FACERECALL_MODEL_DIR", str(tmp_path / "models"))
    monkeypatch.setenv("FACERECALL_ENCRYPTION_KEY", "")
    # Keep the application's own engine pointed at a throwaway file.
    monkeypatch.setenv("FACERECALL_DATABASE_URL", f"sqlite:///{tmp_path.as_posix()}/test.db")
    get_settings.cache_clear()
    from app.core import crypto

    crypto.reset_cache()
    return tmp_path


@pytest.fixture()
def db_session(data_dir: Path):
    engine_ = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine_)
    TestingSession = sessionmaker(bind=engine_, autoflush=False, autocommit=False, future=True)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine_)


@pytest.fixture()
def client(db_session, data_dir, monkeypatch: pytest.MonkeyPatch):
    from app import main

    application = main.create_app()

    def override_db():
        yield db_session

    application.dependency_overrides[get_db] = override_db
    with TestClient(application) as test_client:
        yield test_client
    application.dependency_overrides.clear()


@pytest.fixture()
def jpeg_bytes() -> bytes:
    """A mid-grey image that passes quality checks but has no real face."""
    import cv2

    image = np.full((320, 320, 3), 128, dtype=np.uint8)
    # Add texture so the Laplacian-variance sharpness check passes.
    rng = np.random.default_rng(7)
    noise = rng.integers(0, 40, size=image.shape, dtype=np.uint8)
    image = np.clip(image.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


def create_person(client, name: str = "Maya Rodrigues", **overrides) -> dict:
    payload = {
        "name": name,
        "relationship": "Neighbour",
        "where_met": "Community garden",
        "organization_or_group": "Garden club",
        "notes": "Runs the seed swap.",
        "reminder": "Ask about the seedlings.",
        "consent_confirmed": True,
    }
    payload.update(overrides)
    response = client.post("/api/v1/people", json=payload)
    assert response.status_code == 201, response.text
    return response.json()
