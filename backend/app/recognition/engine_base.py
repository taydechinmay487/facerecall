"""Adapter interface between the API and whatever face model is installed.

Detection, embedding and matching are separate concerns:

* `FaceEngine.detect` -> zero or more `DetectedFace`
* `FaceEngine.embed`  -> one L2-normalised vector per face
* `app.recognition.matching.decide` -> a structured, threshold-based decision

Swapping in a different pretrained model means implementing this protocol; no
route handler needs to change.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

import numpy as np


class EngineUnavailable(RuntimeError):
    """Raised when pretrained weights are missing or cannot be loaded."""


class ImageRejected(ValueError):
    """Raised when an upload is not a usable image."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class DetectedFace:
    box: tuple[int, int, int, int]
    confidence: float
    # Model-specific alignment payload (e.g. the raw YuNet row for SFace).
    payload: Any = None
    landmarks: list[tuple[float, float]] = field(default_factory=list)


@dataclass
class EmbeddedFace:
    vector: np.ndarray
    quality: float | None = None


class FaceEngine(Protocol):
    name: str
    detector_name: str
    version: str
    preprocessing_version: str
    embedding_dim: int
    similarity_metric: str

    @property
    def ready(self) -> bool: ...

    def load(self) -> None: ...

    def detect(self, image: np.ndarray) -> list[DetectedFace]: ...

    def embed(self, image: np.ndarray, face: DetectedFace) -> EmbeddedFace: ...


def to_float32_vector(raw: object, expected_dim: int | None = None) -> np.ndarray:
    """Validate and normalise an embedding coming from a model or the database."""
    vector = np.asarray(raw, dtype=np.float32).reshape(-1)
    if vector.size == 0:
        raise ValueError("Embedding is empty.")
    if expected_dim is not None and vector.size != expected_dim:
        raise ValueError(f"Embedding has {vector.size} dimensions, expected {expected_dim}.")
    if not np.all(np.isfinite(vector)):
        raise ValueError("Embedding contains non-finite values.")
    norm = float(np.linalg.norm(vector))
    if norm <= 1e-8:
        raise ValueError("Embedding has zero magnitude.")
    return (vector / norm).astype(np.float32)
