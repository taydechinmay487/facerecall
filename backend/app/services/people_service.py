"""Person profile service: CRUD, consent, serialization."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.enrollment import FaceEnrollment
from app.models.interaction import InteractionLog
from app.models.person import PersonProfile, utcnow
from app.models.settings import SETTINGS_ID, AppSettings
from app.schemas.person import (
    EnrollmentRead,
    PersonCreate,
    PersonDetail,
    PersonRead,
    PersonUpdate,
)
from app.services import thumbnails

CONTEXT_FIELDS = ("relationship", "where_met", "organization_or_group", "notes")


def settings_row(db: Session) -> AppSettings:
    row = db.get(AppSettings, SETTINGS_ID)
    if row is None:
        row = AppSettings(id=SETTINGS_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _last_confirmed(db: Session, person_id: int) -> datetime | None:
    value = db.execute(
        select(InteractionLog.occurred_at)
        .where(InteractionLog.person_profile_id == person_id)
        .where(InteractionLog.confirmation_status.in_(("confirmed", "corrected")))
        .order_by(InteractionLog.occurred_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def build_person_read(person: PersonProfile, db: Session) -> PersonRead:
    enrollments = list(person.enrollments)
    completed = sum(1 for field in CONTEXT_FIELDS if getattr(person, field))
    return PersonRead(
        id=person.id,
        name=person.name,
        relationship=person.relationship,
        where_met=person.where_met,
        organization_or_group=person.organization_or_group,
        notes=person.notes,
        reminder=person.reminder,
        consent_status=person.consent_status,
        consent_recorded_at=person.consent_recorded_at,
        created_at=person.created_at,
        updated_at=person.updated_at,
        is_demo=person.is_demo,
        enrollment_count=len(enrollments),
        avatar_url=(
            f"/api/v1/people/{person.id}/avatar"
            if any(item.thumbnail_filename for item in enrollments)
            else None
        ),
        last_confirmed_interaction_at=_last_confirmed(db, person.id),
        context_fields_completed=completed,
        context_fields_total=len(CONTEXT_FIELDS),
    )


def build_enrollment_read(enrollment: FaceEnrollment) -> EnrollmentRead:
    return EnrollmentRead(
        id=enrollment.id,
        person_profile_id=enrollment.person_profile_id,
        model_name=enrollment.model_name,
        model_version=enrollment.model_version,
        preprocessing_version=enrollment.preprocessing_version,
        embedding_dim=enrollment.embedding_dim,
        quality_score=enrollment.quality_score,
        has_thumbnail=bool(enrollment.thumbnail_filename),
        created_at=enrollment.created_at,
        is_demo=bool(enrollment.is_demo),
    )


def build_person_detail(person: PersonProfile, db: Session) -> PersonDetail:
    base = build_person_read(person, db)
    interaction_count = db.execute(
        select(func.count(InteractionLog.id)).where(
            InteractionLog.person_profile_id == person.id
        )
    ).scalar_one()
    return PersonDetail(
        **base.model_dump(),
        enrollments=[build_enrollment_read(item) for item in person.enrollments],
        interaction_count=int(interaction_count),
    )


def get_person(db: Session, person_id: int) -> PersonProfile:
    person = db.get(PersonProfile, person_id)
    if person is None or person.is_demo:
        raise ApiError(404, "person_not_found", "That person is not in your directory.")
    return person


def list_people_query(
    *,
    q: str | None,
    relationship: str | None,
    dataset: str,
    sort: str,
) -> Select[tuple[PersonProfile]]:
    stmt = select(PersonProfile).where(PersonProfile.is_demo.is_(dataset == "demo"))
    if q:
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(PersonProfile.name).like(needle),
                func.lower(func.coalesce(PersonProfile.relationship, "")).like(needle),
                func.lower(func.coalesce(PersonProfile.organization_or_group, "")).like(needle),
            )
        )
    if relationship:
        stmt = stmt.where(PersonProfile.relationship == relationship)
    if sort == "recent":
        stmt = stmt.order_by(PersonProfile.updated_at.desc(), PersonProfile.id.desc())
    elif sort == "recently_met":
        stmt = stmt.order_by(PersonProfile.updated_at.desc(), PersonProfile.name.asc())
    else:
        stmt = stmt.order_by(func.lower(PersonProfile.name).asc(), PersonProfile.id.asc())
    return stmt


def create_person(db: Session, payload: PersonCreate) -> PersonProfile:
    person = PersonProfile(
        name=payload.name,
        relationship=payload.relationship,
        where_met=payload.where_met,
        organization_or_group=payload.organization_or_group,
        notes=payload.notes,
        reminder=payload.reminder,
        consent_status=True,
        consent_recorded_at=utcnow(),
        is_demo=payload.is_demo,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def update_person(db: Session, person: PersonProfile, payload: PersonUpdate) -> PersonProfile:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return person
    for key, value in data.items():
        setattr(person, key, value)
    person.updated_at = utcnow()
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def delete_person(db: Session, person: PersonProfile) -> dict[str, int]:
    deleted_files = 0
    for enrollment in list(person.enrollments):
        if thumbnails.delete_thumbnail(enrollment.thumbnail_filename):
            deleted_files += 1
    enrollments = len(person.enrollments)
    interactions = len(person.interactions)
    db.delete(person)
    db.commit()
    return {
        "deleted_enrollments": enrollments,
        "deleted_interactions": interactions,
        "deleted_files": deleted_files,
    }


def withdraw_consent(db: Session, person: PersonProfile) -> dict[str, int | str | bool]:
    """Withdrawing consent deletes the biometric records in the same transaction."""
    deleted_files = 0
    enrollments = list(person.enrollments)
    for enrollment in enrollments:
        if thumbnails.delete_thumbnail(enrollment.thumbnail_filename):
            deleted_files += 1
        db.delete(enrollment)
    person.consent_status = False
    person.consent_recorded_at = utcnow()
    db.add(person)
    db.commit()
    return {
        "person_id": person.id,
        "consent_status": False,
        "enrollments_deleted": len(enrollments),
        "message": (
            "Consent withdrawn. Stored face data was deleted. The profile and its "
            "interaction history remain until you delete the profile."
        ),
    }


def relationship_options(db: Session, dataset: str = "real") -> list[str]:
    rows = db.execute(
        select(PersonProfile.relationship)
        .where(PersonProfile.is_demo.is_(dataset == "demo"))
        .where(PersonProfile.relationship.is_not(None))
        .distinct()
        .order_by(PersonProfile.relationship)
    ).scalars()
    return [row for row in rows if row]
