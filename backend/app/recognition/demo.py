"""Simulated recognition for demo mode.

This module performs **no computer vision**. It exists so the interface can be
explored without enrolling anybody, and every response it produces is marked
`mode="demo"` / `is_simulated=True` so the UI can label it loudly. Demo profiles
live in a separate dataset (`PersonProfile.is_demo`) and are never compared in
real recognition.
"""

from __future__ import annotations

import hashlib
import random
import time

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.person import PersonProfile
from app.recognition.matching import Decision
from app.services.people_service import settings_row as _settings_row
from app.schemas.recognition import PersonContext, RecognitionDiagnostics, RecognitionResult

DEMO_MODEL = "demo-synthetic"
DEMO_VERSION = "0"


def synthetic_embedding(seed_text: str, dim: int = 128) -> np.ndarray:
    """Deterministic pseudo-vector for demo enrolments (not a face model)."""
    digest = hashlib.sha256(seed_text.encode("utf-8")).digest()
    rng = np.random.default_rng(int.from_bytes(digest[:8], "big"))
    vector = rng.normal(size=dim).astype(np.float32)
    norm = float(np.linalg.norm(vector))
    return (vector / norm).astype(np.float32) if norm else vector


def demo_recognize(db: Session, window_seconds: int = 15) -> RecognitionResult:
    started = time.perf_counter()
    people = list(
        db.execute(
            select(PersonProfile)
            .where(PersonProfile.is_demo.is_(True))
            .order_by(PersonProfile.id)
        ).scalars()
    )
    settings_row = _settings_row(db)

    if not people:
        raise ApiError(
            409,
            "demo_not_seeded",
            "Demo mode has no demo profiles yet. Seed the demo dataset first.",
            {"hint": "POST /api/v1/demo/seed"},
        )

    # Stable within a short window: mirrors the "hold the result" behaviour of
    # real recognition instead of flickering between people every frame.
    bucket = int(time.time() // window_seconds)
    chosen = random.Random(bucket).choice(people)

    decision = Decision(
        decision="accepted_match",
        matched_person_id=chosen.id,
        explanation=(
            "Simulated demo result. This was generated from the demo dataset, "
            "not from camera analysis."
        ),
        best_score=None,
        second_best_score=None,
        best_minus_second=None,
        candidates_considered=len(people),
    )

    from app.recognition.pipeline import last_confirmed_at

    person = PersonContext(
        id=chosen.id,
        name=chosen.name,
        relationship=chosen.relationship,
        where_met=chosen.where_met,
        organization_or_group=chosen.organization_or_group,
        notes=chosen.notes,
        reminder=chosen.reminder,
        avatar_url=None,
        last_confirmed_interaction_at=last_confirmed_at(db, chosen.id),
        enrollment_count=len(chosen.enrollments),
    )

    return RecognitionResult(
        decision=decision.decision,  # type: ignore[arg-type]
        explanation=decision.explanation,
        person=person,
        diagnostics=RecognitionDiagnostics(
            threshold=settings_row.recognition_threshold,
            ambiguity_margin=settings_row.ambiguity_margin,
            candidates_considered=len(people),
            faces_detected=0,
        ),
        processing_ms=round((time.perf_counter() - started) * 1000, 1),
        model_name=DEMO_MODEL,
        model_version=DEMO_VERSION,
        preprocessing_version="none",
        mode="demo",
        is_simulated=True,
        guidance=(
            "Demo mode is on. Turn it off to use the real camera pipeline with your own "
            "enrolled profiles."
        ),
    )
