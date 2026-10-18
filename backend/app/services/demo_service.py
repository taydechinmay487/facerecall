"""Fictional demo dataset.

Demo people are flagged `is_demo=1`, live in their own directory, and are
excluded from real recognition. Their "embeddings" are synthetic pseudo-vectors
so the demo exercises the real storage path without claiming computer vision.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.enrollment import FaceEnrollment
from app.models.interaction import InteractionLog
from app.models.person import PersonProfile, utcnow
from app.recognition.demo import DEMO_MODEL, DEMO_VERSION, synthetic_embedding

DEMO_PEOPLE = [
    {
        "name": "Maya Rodrigues",
        "relationship": "Neighbour",
        "where_met": "Riverside community garden, spring clean-up day",
        "organization_or_group": "Riverside Garden Club",
        "notes": "Runs the seed swap. Two children, both at the local primary school.",
        "reminder": "Ask how the tomato seedlings turned out.",
        "days_ago": 9,
    },
    {
        "name": "Daniel Okafor",
        "relationship": "Colleague",
        "where_met": "Onboarding week at Northwind Studio",
        "organization_or_group": "Northwind Studio, design team",
        "notes": "Leads accessibility reviews. Prefers written summaries over calls.",
        "reminder": "Send the audit checklist before Thursday.",
        "days_ago": 3,
    },
    {
        "name": "Priya Raman",
        "relationship": "Former classmate",
        "where_met": "University statistics tutorial, second year",
        "organization_or_group": "Alumni book club",
        "notes": "Now a data analyst. Organises the monthly book club meetup.",
        "reminder": None,
        "days_ago": 21,
    },
    {
        "name": "Tomas Lindqvist",
        "relationship": "Physiotherapist",
        "where_met": "Fern Street clinic",
        "organization_or_group": "Fern Street Physiotherapy",
        "notes": "Appointments are usually Tuesday mornings.",
        "reminder": "Bring the exercise sheet to the next appointment.",
        "days_ago": None,
    },
]


def seed(db: Session) -> int:
    existing = db.execute(
        select(PersonProfile).where(PersonProfile.is_demo.is_(True))
    ).scalars().first()
    if existing is not None:
        return 0

    for entry in DEMO_PEOPLE:
        person = PersonProfile(
            name=entry["name"],
            relationship=entry["relationship"],
            where_met=entry["where_met"],
            organization_or_group=entry["organization_or_group"],
            notes=entry["notes"],
            reminder=entry["reminder"],
            consent_status=True,
            consent_recorded_at=utcnow(),
            is_demo=True,
        )
        db.add(person)
        db.flush()
        for photo_index in range(2):
            vector = synthetic_embedding(f"{entry['name']}:{photo_index}")
            db.add(
                FaceEnrollment(
                    person_profile_id=person.id,
                    embedding_blob=vector.astype("float32").tobytes(),
                    embedding_dim=int(vector.size),
                    model_name=DEMO_MODEL,
                    model_version=DEMO_VERSION,
                    preprocessing_version="none",
                    thumbnail_filename=None,
                    quality_score=None,
                    is_demo=1,
                )
            )
        if entry["days_ago"] is not None:
            occurred = datetime.now(timezone.utc) - timedelta(days=int(entry["days_ago"]))
            db.add(
                InteractionLog(
                    person_profile_id=person.id,
                    occurred_at=occurred,
                    event_source="manual",
                    confirmation_status="confirmed",
                    user_note="Demo entry — sample data, not a real meeting.",
                )
            )
    db.commit()
    return len(DEMO_PEOPLE)


def clear(db: Session) -> int:
    people = list(
        db.execute(select(PersonProfile).where(PersonProfile.is_demo.is_(True))).scalars()
    )
    count = len(people)
    for person in people:
        db.delete(person)
    db.commit()
    return count


def delete_all_demo_enrollments(db: Session) -> None:
    db.execute(delete(FaceEnrollment).where(FaceEnrollment.is_demo == 1))
    db.commit()
