"""Enrolment: photo -> validated single face -> embedding -> database.

Consent is checked here as well as in the route, because this is the module
that actually stores biometric data.
"""

from __future__ import annotations

import logging

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import protect_bytes, reveal_bytes
from app.core.errors import ApiError
from app.models.enrollment import FaceEnrollment
from app.models.person import PersonProfile
from app.recognition.engine_base import EngineUnavailable, FaceEngine, ImageRejected
from app.recognition.imaging import (
    assess_quality,
    decode_image,
    make_thumbnail,
    validate_upload_meta,
)
from app.recognition.matching import cosine_similarity
from app.recognition.pipeline import get_engine
from app.services import settings_service, thumbnails

logger = logging.getLogger("facerecall.enrollment")

MAX_ENROLLMENTS = 3
DUPLICATE_SIMILARITY = 0.985


def enroll(
    db: Session,
    person: PersonProfile,
    data: bytes,
    filename: str | None,
    content_type: str | None,
    engine: FaceEngine | None = None,
) -> FaceEnrollment:
    if person.is_demo:
        raise ApiError(
            400,
            "demo_read_only",
            "Demo profiles are read-only. Turn off demo mode to enrol your own people.",
        )
    if not person.consent_status:
        raise ApiError(
            409,
            "consent_required",
            "Record the person's consent before storing any face data.",
        )
    if len(person.enrollments) >= MAX_ENROLLMENTS:
        raise ApiError(
            409,
            "enrollment_limit",
            f"This person already has {MAX_ENROLLMENTS} photos, which is the current limit. "
            "Remove one before adding another.",
        )

    try:
        validate_upload_meta(filename, content_type, len(data))
        image = decode_image(data)
    except ImageRejected as exc:
        raise ApiError(422, exc.code, exc.message) from exc

    quality, issue = assess_quality(image)
    if issue == "low_light":
        raise ApiError(
            422,
            "low_light",
            "That photo is too dark to enrol reliably. Try a brighter, evenly lit photo.",
        )
    if issue == "blurry_image":
        raise ApiError(
            422,
            "blurry_image",
            "That photo is too blurry to enrol reliably. Try a sharper photo.",
        )

    active = engine or get_engine()
    try:
        faces = active.detect(image)
    except EngineUnavailable as exc:
        raise ApiError(503, "engine_unavailable", str(exc)) from exc

    if not faces:
        raise ApiError(
            422,
            "no_face_detected",
            "No face was detected in that photo. Use a clear, front-facing photo of one person.",
        )
    if len(faces) > 1:
        raise ApiError(
            422,
            "multiple_faces_detected",
            "That photo contains more than one face. Enrolment photos must show one person.",
        )

    try:
        embedded = active.embed(image, faces[0])
    except EngineUnavailable as exc:
        raise ApiError(503, "engine_unavailable", str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Enrolment embedding failed")
        raise ApiError(422, "embedding_failed", "That face could not be read. Try another photo.") from exc

    # Reject obvious duplicates so three near-identical frames add no value.
    for existing in person.enrollments:
        try:
            existing_vector = np.frombuffer(
                reveal_bytes(existing.embedding_blob), dtype=np.float32, count=existing.embedding_dim
            )
            if (
                existing.model_version == active.version
                and cosine_similarity(embedded.vector, existing_vector) >= DUPLICATE_SIMILARITY
            ):
                raise ApiError(
                    409,
                    "duplicate_photo",
                    "That looks like a photo you already enrolled. Try a different angle or expression.",
                )
        except ApiError:
            raise
        except Exception:  # noqa: BLE001 - incompatible rows are replaced, not fatal
            continue

    # `retain_thumbnails` is a user preference stored in the database, not an
    # environment setting; the environment only controls the thumbnail size.
    preferences = settings_service.get_or_create(db)
    stored_thumb: str | None = None
    if preferences.retain_thumbnails:
        preview = make_thumbnail(image, get_settings().thumbnail_max_edge)
        if preview:
            stored_thumb = thumbnails.save_thumbnail(preview)

    enrollment = FaceEnrollment(
        person_profile_id=person.id,
        embedding_blob=protect_bytes(embedded.vector.astype(np.float32).tobytes()),
        embedding_dim=int(embedded.vector.size),
        model_name=active.name,
        model_version=active.version,
        preprocessing_version=active.preprocessing_version,
        thumbnail_filename=stored_thumb,
        quality_score=round(min(quality, embedded.quality or 1.0), 4),
        is_demo=0,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    logger.info(
        "Enrolled face for person_id=%s model=%s dims=%s",
        person.id,
        active.name,
        embedded.vector.size,
    )
    return enrollment


def remove(db: Session, person: PersonProfile, enrollment_id: int) -> None:
    enrollment = next((item for item in person.enrollments if item.id == enrollment_id), None)
    if enrollment is None:
        raise ApiError(404, "enrollment_not_found", "That enrolment photo was not found.")
    thumbnails.delete_thumbnail(enrollment.thumbnail_filename)
    db.delete(enrollment)
    db.commit()
