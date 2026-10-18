from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Decision = Literal[
    "accepted_match",
    "unknown_person",
    "not_confident",
    "no_face_detected",
    "multiple_faces_detected",
    "processing_error",
]

OperationMode = Literal["real", "demo"]


class PersonContext(BaseModel):
    id: int
    name: str
    relationship: str | None = None
    where_met: str | None = None
    organization_or_group: str | None = None
    notes: str | None = None
    reminder: str | None = None
    avatar_url: str | None = None
    last_confirmed_interaction_at: datetime | None = None
    enrollment_count: int = 0


class RecognitionDiagnostics(BaseModel):
    """Raw scores for debugging. Never rendered as a percentage of certainty."""

    threshold: float
    ambiguity_margin: float
    best_score: float | None = None
    second_best_score: float | None = None
    best_minus_second: float | None = None
    candidates_considered: int = 0
    face_quality: float | None = None
    faces_detected: int = 0


class RecognitionResult(BaseModel):
    # `model_name` / `model_version` are deliberate field names for the ML model.
    model_config = ConfigDict(protected_namespaces=())

    decision: Decision
    explanation: str
    person: PersonContext | None = None
    diagnostics: RecognitionDiagnostics
    processing_ms: float
    model_name: str
    model_version: str
    preprocessing_version: str
    mode: OperationMode
    is_simulated: bool = False
    guidance: str | None = None
