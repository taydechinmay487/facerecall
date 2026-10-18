"""User data export.

Includes profile data, interaction history, settings and (optionally) the stored
biometric embeddings encoded as base64, because they are the user's data. The
bundle is explicit about what it contains -- it is not a backup format that can
be re-imported without care.
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import reveal_bytes
from app.models.interaction import InteractionLog
from app.models.person import PersonProfile
from app.models.settings import AppSettings
from app.services.people_service import build_person_read, settings_row
from app.services.interaction_service import to_read


def build_export(db: Session) -> dict:
    settings = get_settings()
    people = list(
        db.execute(
            select(PersonProfile)
            .where(PersonProfile.is_demo.is_(False))
            .order_by(PersonProfile.name)
        ).scalars()
    )
    rows = db.execute(
        select(InteractionLog, PersonProfile.name)
        .join(PersonProfile, InteractionLog.person_profile_id == PersonProfile.id)
        .where(PersonProfile.is_demo.is_(False))
        .order_by(InteractionLog.occurred_at.desc())
    ).all()

    people_payload = []
    for person in people:
        base = build_person_read(person, db).model_dump(mode="json")
        enrollments = []
        for enrollment in person.enrollments:
            try:
                vector = reveal_bytes(enrollment.embedding_blob)
                encoded = base64.b64encode(vector).decode("ascii")
            except Exception:  # noqa: BLE001 - never fail an export over one row
                encoded = None
            enrollments.append(
                {
                    "id": enrollment.id,
                    "model_name": enrollment.model_name,
                    "model_version": enrollment.model_version,
                    "preprocessing_version": enrollment.preprocessing_version,
                    "embedding_dim": enrollment.embedding_dim,
                    "created_at": enrollment.created_at.isoformat(),
                    "embedding_base64_float32": encoded,
                }
            )
        base["enrollments"] = enrollments
        people_payload.append(base)

    row = settings_row(db)
    return {
        "exported_at": datetime.now(timezone.utc),
        "app_version": settings.app_version,
        "warning": (
            "This file contains biometric data (face embeddings) and personal notes. "
            "Store it securely and delete it when no longer needed."
        ),
        "people": people_payload,
        "interactions": [
            to_read(interaction, name).model_dump(mode="json") for interaction, name in rows
        ],
        "settings": {
            "recognition_threshold": row.recognition_threshold,
            "ambiguity_margin": row.ambiguity_margin,
            "frame_interval_ms": row.frame_interval_ms,
            "voice_enabled": row.voice_enabled,
            "speech_rate": row.speech_rate,
            "text_scale": row.text_scale,
            "reduce_motion": row.reduce_motion,
            "retain_thumbnails": row.retain_thumbnails,
            "retain_interaction_history": row.retain_interaction_history,
        },
    }


def delete_all(db: Session, include_demo: bool = False) -> dict[str, int | bool | str]:
    from app.services import thumbnails
    from app.services.settings_service import reset

    people = list(
        db.execute(
            select(PersonProfile).where(
                PersonProfile.is_demo.is_(False) if not include_demo else True
            )
        ).scalars()
    )
    deleted_people = len(people)
    deleted_interactions = sum(len(person.interactions) for person in people)
    deleted_enrollments = sum(len(person.enrollments) for person in people)
    for person in people:
        db.delete(person)
    db.commit()

    deleted_files = thumbnails.delete_all_thumbnails()
    reset(db)
    return {
        "deleted_people": deleted_people,
        "deleted_interactions": deleted_interactions,
        "deleted_enrollments": deleted_enrollments,
        "deleted_files": deleted_files,
        "settings_reset": True,
        "message": (
            "All profiles, face enrolments, interaction history and stored thumbnails "
            "were deleted, and settings were reset."
        ),
    }
