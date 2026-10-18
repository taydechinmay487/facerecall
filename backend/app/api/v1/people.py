from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import read_upload
from app.core.errors import ApiError
from app.database.session import get_db
from app.schemas.person import (
    ConsentWithdrawResult,
    PersonCreate,
    PersonDetail,
    PersonRead,
    PersonUpdate,
)
from app.services import enrollment_service, people_service, thumbnails

router = APIRouter(prefix="/people", tags=["people"])


@router.get("")
def list_people(
    q: str | None = Query(default=None, max_length=120),
    relationship: str | None = Query(default=None, max_length=80),
    sort: Literal["name", "recent"] = "name",
    dataset: Literal["real", "demo"] = "real",
    limit: int = Query(default=48, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    stmt = people_service.list_people_query(
        q=q, relationship=relationship, dataset=dataset, sort=sort
    )
    total = int(
        db.execute(
            select(func.count()).select_from(stmt.order_by(None).subquery())
        ).scalar_one()
    )
    rows = db.execute(stmt.limit(limit).offset(offset)).scalars().all()
    return {
        "items": [people_service.build_person_read(row, db) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "relationships": people_service.relationship_options(db, dataset),
    }


@router.post("", status_code=201, response_model=PersonDetail)
def create_person(payload: PersonCreate, db: Session = Depends(get_db)) -> PersonDetail:
    person = people_service.create_person(db, payload)
    db.refresh(person)
    return people_service.build_person_detail(person, db)


@router.get("/{person_id}", response_model=PersonDetail)
def get_person(person_id: int, db: Session = Depends(get_db)) -> PersonDetail:
    person = people_service.get_person(db, person_id)
    return people_service.build_person_detail(person, db)


@router.patch("/{person_id}", response_model=PersonDetail)
def update_person(
    person_id: int, payload: PersonUpdate, db: Session = Depends(get_db)
) -> PersonDetail:
    person = people_service.get_person(db, person_id)
    people_service.update_person(db, person, payload)
    return people_service.build_person_detail(person, db)


@router.delete("/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)) -> dict:
    person = people_service.get_person(db, person_id)
    result = people_service.delete_person(db, person)
    return {"deleted": True, "person_id": person_id, **result}


@router.get("/{person_id}/avatar")
def get_avatar(person_id: int, db: Session = Depends(get_db)) -> Response:
    person = people_service.get_person(db, person_id)
    for enrollment in person.enrollments:
        path = thumbnails.thumbnail_path(enrollment.thumbnail_filename)
        if path is not None:
            return FileResponse(
                path,
                media_type="image/jpeg",
                headers={
                    "Cache-Control": "private, max-age=60",
                    "X-Content-Type-Options": "nosniff",
                },
            )
    raise ApiError(404, "avatar_not_found", "This person has no stored preview image.")


@router.post("/{person_id}/enroll", status_code=201)
async def enroll_face(
    person_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    person = people_service.get_person(db, person_id)
    data = await read_upload(file)
    enrollment = enrollment_service.enroll(
        db, person, data, file.filename, file.content_type
    )
    return {
        "enrollment": people_service.build_enrollment_read(enrollment),
        "person": people_service.build_person_detail(person, db),
    }


@router.delete("/{person_id}/enrollments/{enrollment_id}")
def delete_enrollment(
    person_id: int, enrollment_id: int, db: Session = Depends(get_db)
) -> dict:
    person = people_service.get_person(db, person_id)
    enrollment_service.remove(db, person, enrollment_id)
    return {"deleted": True, "enrollment_id": enrollment_id}


@router.post("/{person_id}/consent/withdraw", response_model=ConsentWithdrawResult)
def withdraw_consent(person_id: int, db: Session = Depends(get_db)) -> ConsentWithdrawResult:
    person = people_service.get_person(db, person_id)
    if not person.consent_status:
        raise ApiError(
            409,
            "consent_already_withdrawn",
            "Consent for this person has already been withdrawn.",
        )
    return ConsentWithdrawResult(**people_service.withdraw_consent(db, person))

