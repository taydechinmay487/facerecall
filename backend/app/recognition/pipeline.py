"""Recognition pipeline: validate -> detect -> embed -> match -> context.

Every stage is explicit so a failure at one stage cannot silently produce an
identity. Only `accepted_match` carries a person; everything else is a safe
negative outcome.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import reveal_bytes
from app.core.errors import ApiError
from app.models.enrollment import FaceEnrollment
from app.models.interaction import InteractionLog
from app.models.person import PersonProfile
from app.models.settings import AppSettings
from app.recognition.engine_base import EngineUnavailable, FaceEngine, ImageRejected
from app.recognition.imaging import assess_quality, decode_image, validate_upload_meta
from app.recognition.matching import Decision, EnrolledVector, decide
from app.recognition.opencv_engine import OpenCVFaceEngine
from app.schemas.recognition import (
    PersonContext,
    RecognitionDiagnostics,
    RecognitionResult,
)
from app.schemas.system import EngineStatus

logger = logging.getLogger("facerecall.pipeline")

_engine = OpenCVFaceEngine()

API_PREFIX = "/api/v1"


def get_engine() -> FaceEngine:
    """FastAPI dependency / test seam for the active engine."""
    return _engine


def engine_status() -> EngineStatus:
    engine = get_engine()
    present = bool(getattr(engine, "models_present", False))
    return EngineStatus(
        mode="real" if present else "unavailable",
        detector_name=engine.detector_name,
        model_name=engine.name,
        model_version=engine.version,
        embedding_dim=engine.embedding_dim if present else None,
        similarity_metric=engine.similarity_metric,
        models_present=present,
        message=(
            "Real recognition is available. Detector: YuNet. Embeddings: SFace "
            "(128-D, cosine similarity)."
            if present
            else "Real recognition models are not installed. Run scripts/download_models.py "
            "or continue in demo mode, where every result is simulated and labelled."
        ),
    )


def load_vectors(
    db: Session, dataset: str = "real", engine: FaceEngine | None = None
) -> list[EnrolledVector]:
    """Load compatible enrolments for exactly one dataset (real *or* demo)."""
    active = engine or _engine
    wanted_demo = dataset == "demo"
    rows = db.execute(
        select(FaceEnrollment, PersonProfile)
        .join(PersonProfile, FaceEnrollment.person_profile_id == PersonProfile.id)
        .where(PersonProfile.consent_status.is_(True))
        .where(PersonProfile.is_demo.is_(wanted_demo))
    ).all()

    vectors: list[EnrolledVector] = []
    skipped = 0
    for enrollment, _person in rows:
        if (
            enrollment.model_name != active.name
            or enrollment.model_version != active.version
            or enrollment.preprocessing_version != active.preprocessing_version
        ):
            skipped += 1
            continue
        try:
            raw = reveal_bytes(enrollment.embedding_blob)
            vector = np.frombuffer(raw, dtype=np.float32, count=enrollment.embedding_dim)
            vectors.append(
                EnrolledVector(
                    person_id=enrollment.person_profile_id,
                    vector=vector.copy(),
                    enrollment_id=enrollment.id,
                )
            )
        except Exception:  # noqa: BLE001 - a corrupt row must not break recognition
            skipped += 1
    if skipped:
        # Counts only: never log identifiers or biometric values.
        logger.warning(
            "Skipped %s enrolment(s) with incompatible or unreadable embeddings", skipped
        )
    return vectors


def last_confirmed_at(db: Session, person_id: int) -> datetime | None:
    row = db.execute(
        select(InteractionLog.occurred_at)
        .where(InteractionLog.person_profile_id == person_id)
        .where(InteractionLog.confirmation_status.in_(("confirmed", "corrected")))
        .order_by(InteractionLog.occurred_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        return None
    return row if row.tzinfo is not None else row.replace(tzinfo=timezone.utc)


def person_context(db: Session, person: PersonProfile) -> PersonContext:
    enrollments = list(person.enrollments)
    return PersonContext(
        id=person.id,
        name=person.name,
        relationship=person.relationship,
        where_met=person.where_met,
        organization_or_group=person.organization_or_group,
        notes=person.notes,
        reminder=person.reminder,
        avatar_url=(
            f"{API_PREFIX}/people/{person.id}/avatar"
            if any(item.thumbnail_filename for item in enrollments)
            else None
        ),
        last_confirmed_interaction_at=last_confirmed_at(db, person.id),
        enrollment_count=len(enrollments),
    )


def _diagnostics(
    decision: Decision,
    settings_row: AppSettings,
    quality: float | None,
    faces: int,
) -> RecognitionDiagnostics:
    return RecognitionDiagnostics(
        threshold=settings_row.recognition_threshold,
        ambiguity_margin=settings_row.ambiguity_margin,
        best_score=decision.best_score,
        second_best_score=decision.second_best_score,
        best_minus_second=decision.best_minus_second,
        candidates_considered=decision.candidates_considered,
        face_quality=quality,
        faces_detected=faces,
    )


def _build(
    *,
    active: FaceEngine,
    settings_row: AppSettings,
    started: float,
    decision: Decision,
    db: Session | None = None,
    person: PersonProfile | None = None,
    quality: float | None = None,
    faces: int = 0,
    guidance: str | None = None,
) -> RecognitionResult:
    return RecognitionResult(
        decision=decision.decision,  # type: ignore[arg-type]
        explanation=decision.explanation,
        person=person_context(db, person) if (db is not None and person is not None) else None,
        diagnostics=_diagnostics(decision, settings_row, quality, faces),
        processing_ms=round((time.perf_counter() - started) * 1000, 1),
        model_name=active.name,
        model_version=active.version,
        preprocessing_version=active.preprocessing_version,
        mode="real",
        is_simulated=False,
        guidance=guidance,
    )


def _simple(decision: str, explanation: str) -> Decision:
    return Decision(
        decision=decision,
        matched_person_id=None,
        explanation=explanation,
        best_score=None,
        second_best_score=None,
        best_minus_second=None,
        candidates_considered=0,
    )


def recognize_upload(
    db: Session,
    data: bytes,
    filename: str | None,
    content_type: str | None,
    settings_row: AppSettings,
    engine: FaceEngine | None = None,
) -> RecognitionResult:
    active = engine or get_engine()
    started = time.perf_counter()

    def failure(code: str, message: str, guidance: str | None = None) -> RecognitionResult:
        logger.info("Recognition stopped at stage=%s", code)
        return _build(
            active=active,
            settings_row=settings_row,
            started=started,
            decision=_simple("processing_error", message),
            guidance=guidance,
        )

    try:
        validate_upload_meta(filename, content_type, len(data))
        image = decode_image(data)
    except ImageRejected as exc:
        return failure(exc.code, exc.message, "Try another photo or adjust the lighting.")

    quality, quality_issue = assess_quality(image)
    if quality_issue == "low_light":
        return failure(
            "low_light",
            "The image is too dark to analyse reliably.",
            "Move to a brighter spot, or add light in front of the camera.",
        )
    if quality_issue == "blurry_image":
        return failure(
            "blurry_image",
            "The image is too blurry to analyse reliably.",
            "Hold the camera steadier and wait for the face to come into focus.",
        )

    try:
        faces = active.detect(image)
    except EngineUnavailable as exc:
        raise ApiError(503, "engine_unavailable", str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - never leak model internals
        logger.exception("Detection failed")
        raise ApiError(
            503, "engine_error", "The face model could not process that frame."
        ) from exc

    if not faces:
        return _build(
            active=active,
            settings_row=settings_row,
            started=started,
            decision=_simple("no_face_detected", "No face was found in this frame."),
            quality=quality,
            faces=0,
            guidance="Face the camera with your whole face visible and try again.",
        )

    if len(faces) > 1:
        return _build(
            active=active,
            settings_row=settings_row,
            started=started,
            decision=_simple(
                "multiple_faces_detected",
                "More than one face is in view, so FaceRecall will not choose one.",
            ),
            quality=quality,
            faces=len(faces),
            guidance="Speak with one person at a time and frame a single face.",
        )

    try:
        embedded = active.embed(image, faces[0])
    except EngineUnavailable as exc:
        raise ApiError(503, "engine_unavailable", str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Embedding failed")
        raise ApiError(
            503, "engine_error", "That face could not be converted into a representation."
        ) from exc

    decision = decide(
        embedded.vector,
        load_vectors(db, dataset="real", engine=active),
        float(settings_row.recognition_threshold),
        float(settings_row.ambiguity_margin),
    )
    person = (
        db.get(PersonProfile, decision.matched_person_id)
        if decision.matched_person_id is not None
        else None
    )

    result = _build(
        active=active,
        settings_row=settings_row,
        started=started,
        decision=decision,
        db=db,
        person=person,
        quality=min(quality, embedded.quality or 1.0),
        faces=1,
        guidance=(
            None
            if decision.decision == "accepted_match"
            else "You can enrol more photos of this person, or adjust the threshold in Settings."
        ),
    )
    logger.info(
        "Recognition decision=%s candidates=%s duration_ms=%s",
        result.decision,
        decision.candidates_considered,
        result.processing_ms,
    )
    return result
