"""Interaction history.

A row is only written when a human confirms it. There is no code path that
records an interaction because a face was detected.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Select, func, select, true
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.interaction import InteractionLog
from app.models.person import PersonProfile
from app.schemas.interaction import InteractionCreate, InteractionRead, InteractionUpdate


def to_read(row: InteractionLog, person_name: str) -> InteractionRead:
    occurred = row.occurred_at
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=timezone.utc)
    created = row.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return InteractionRead(
        id=row.id,
        person_profile_id=row.person_profile_id,
        person_name=person_name,
        occurred_at=occurred,
        event_source=row.event_source,  # type: ignore[arg-type]
        confirmation_status=row.confirmation_status,  # type: ignore[arg-type]
        user_note=row.user_note,
        created_at=created,
    )


def _person(db: Session, person_id: int) -> PersonProfile:
    person = db.get(PersonProfile, person_id)
    if person is None:
        raise ApiError(404, "person_not_found", "That person is not in your directory.")
    if person.is_demo:
        raise ApiError(
            400,
            "demo_read_only",
            "Demo profiles are read-only. Turn off demo mode to record real interactions.",
        )
    return person


def create(db: Session, payload: InteractionCreate) -> InteractionLog:
    person = _person(db, payload.person_profile_id)
    occurred = payload.occurred_at or datetime.now(timezone.utc)
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=timezone.utc)
    row = InteractionLog(
        person_profile_id=person.id,
        occurred_at=occurred,
        event_source=payload.event_source,
        confirmation_status=payload.confirmation_status,
        user_note=payload.user_note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def query(
    *,
    person_id: int | None,
    start: datetime | None,
    end: datetime | None,
    limit: int,
    offset: int,
) -> Select[tuple[InteractionLog, str]]:
    stmt = (
        select(InteractionLog, PersonProfile.name)
        .join(PersonProfile, InteractionLog.person_profile_id == PersonProfile.id)
        .where(PersonProfile.is_demo.is_(False))
        .order_by(InteractionLog.occurred_at.desc(), InteractionLog.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if person_id is not None:
        stmt = stmt.where(InteractionLog.person_profile_id == person_id)
    if start is not None:
        stmt = stmt.where(InteractionLog.occurred_at >= start)
    if end is not None:
        stmt = stmt.where(InteractionLog.occurred_at <= end)
    return stmt


def count(
    db: Session,
    person_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> int:
    stmt = (
        select(func.count(InteractionLog.id))
        .join(PersonProfile, InteractionLog.person_profile_id == PersonProfile.id)
        .where(PersonProfile.is_demo.is_(False))
    )
    if person_id is not None:
        stmt = stmt.where(InteractionLog.person_profile_id == person_id)
    if start is not None:
        stmt = stmt.where(InteractionLog.occurred_at >= start)
    if end is not None:
        stmt = stmt.where(InteractionLog.occurred_at <= end)
    return int(db.execute(stmt).scalar_one())


def get(db: Session, interaction_id: int) -> InteractionLog:
    row = db.get(InteractionLog, interaction_id)
    if row is None:
        raise ApiError(404, "interaction_not_found", "That interaction entry was not found.")
    return row


def update(db: Session, row: InteractionLog, payload: InteractionUpdate) -> InteractionLog:
    data = payload.model_dump(exclude_unset=True)
    if "occurred_at" in data and data["occurred_at"] is not None:
        value = data["occurred_at"]
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        data["occurred_at"] = value
    for key, value in data.items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, row: InteractionLog) -> None:
    db.delete(row)
    db.commit()


def clear(db: Session, person_id: int | None = None) -> int:
    """Remove confirmed interaction history, optionally for a single person."""
    rows = db.execute(
        select(InteractionLog).where(
            InteractionLog.person_profile_id == person_id
            if person_id is not None
            else true()
        )
    ).scalars()
    removed = 0
    for row in rows:
        db.delete(row)
        removed += 1
    db.commit()
    return removed
