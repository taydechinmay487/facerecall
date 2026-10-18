"""Dashboard aggregates -- every number is counted from stored rows."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enrollment import FaceEnrollment
from app.models.interaction import InteractionLog
from app.models.person import PersonProfile
from app.schemas.system import DashboardSummary
from app.services.interaction_service import to_read
from app.services.people_service import build_person_read

COMPLETE_CONTEXT_MIN = 3


def summary(db: Session) -> DashboardSummary:
    real_people = list(
        db.execute(
            select(PersonProfile)
            .where(PersonProfile.is_demo.is_(False))
            .order_by(PersonProfile.updated_at.desc())
            .limit(6)
        ).scalars()
    )
    total_people = int(
        db.execute(
            select(func.count(PersonProfile.id)).where(PersonProfile.is_demo.is_(False))
        ).scalar_one()
    )
    demo_people = int(
        db.execute(
            select(func.count(PersonProfile.id)).where(PersonProfile.is_demo.is_(True))
        ).scalar_one()
    )
    total_enrollments = int(
        db.execute(
            select(func.count(FaceEnrollment.id))
            .join(PersonProfile, FaceEnrollment.person_profile_id == PersonProfile.id)
            .where(PersonProfile.is_demo.is_(False))
        ).scalar_one()
    )
    total_interactions = int(
        db.execute(
            select(func.count(InteractionLog.id))
            .join(PersonProfile, InteractionLog.person_profile_id == PersonProfile.id)
            .where(PersonProfile.is_demo.is_(False))
        ).scalar_one()
    )
    since = datetime.now(timezone.utc) - timedelta(days=30)
    recent_count = int(
        db.execute(
            select(func.count(InteractionLog.id))
            .join(PersonProfile, InteractionLog.person_profile_id == PersonProfile.id)
            .where(PersonProfile.is_demo.is_(False))
            .where(InteractionLog.occurred_at >= since)
        ).scalar_one()
    )

    complete = 0
    for person in db.execute(
        select(PersonProfile).where(PersonProfile.is_demo.is_(False))
    ).scalars():
        fields = [
            person.relationship,
            person.where_met,
            person.organization_or_group,
            person.notes,
        ]
        if sum(1 for field in fields if field) >= COMPLETE_CONTEXT_MIN:
            complete += 1

    interactions = db.execute(
        select(InteractionLog, PersonProfile.name)
        .join(PersonProfile, InteractionLog.person_profile_id == PersonProfile.id)
        .where(PersonProfile.is_demo.is_(False))
        .order_by(InteractionLog.occurred_at.desc(), InteractionLog.id.desc())
        .limit(5)
    ).all()

    return DashboardSummary(
        total_people=total_people,
        people_with_complete_context=complete,
        total_enrollments=total_enrollments,
        total_interactions=total_interactions,
        interactions_last_30_days=recent_count,
        recent_people=[build_person_read(person, db) for person in real_people],
        recent_interactions=[
            to_read(interaction, name) for interaction, name in interactions
        ],
        demo_people=demo_people,
        first_use=total_people == 0,
    )
