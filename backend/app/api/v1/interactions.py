from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.interaction import (
    InteractionCreate,
    InteractionRead,
    InteractionUpdate,
)
from app.services import interaction_service

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.get("")
def list_interactions(
    person_id: int | None = Query(default=None, ge=1),
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    stmt = interaction_service.query(
        person_id=person_id, start=start, end=end, limit=limit, offset=offset
    )
    rows = db.execute(stmt).all()
    total = interaction_service.count(db, person_id=person_id, start=start, end=end)
    return {
        "items": [interaction_service.to_read(row, name) for row, name in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("", status_code=201, response_model=InteractionRead)
def create_interaction(
    payload: InteractionCreate, db: Session = Depends(get_db)
) -> InteractionRead:
    row = interaction_service.create(db, payload)
    return interaction_service.to_read(row, row.person.name)


@router.delete("")
def clear_interactions(
    person_id: int | None = Query(default=None, ge=1), db: Session = Depends(get_db)
) -> dict:
    """Delete confirmed interaction history (all of it, or one person's)."""
    removed = interaction_service.clear(db, person_id=person_id)
    return {"deleted": removed, "person_id": person_id}


@router.patch("/{interaction_id}", response_model=InteractionRead)
def update_interaction(
    interaction_id: int, payload: InteractionUpdate, db: Session = Depends(get_db)
) -> InteractionRead:
    row = interaction_service.get(db, interaction_id)
    updated = interaction_service.update(db, row, payload)
    return interaction_service.to_read(updated, updated.person.name)


@router.delete("/{interaction_id}")
def delete_interaction(interaction_id: int, db: Session = Depends(get_db)) -> dict:
    row = interaction_service.get(db, interaction_id)
    interaction_service.delete(db, row)
    return {"deleted": True, "interaction_id": interaction_id}
