from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services import demo_service

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed")
def seed_demo(db: Session = Depends(get_db)) -> dict:
    created = demo_service.seed(db)
    return {
        "created": created,
        "already_present": created == 0,
        "message": (
            "Demo profiles are fictional and stored separately from your real records."
            if created
            else "Demo profiles already exist."
        ),
    }


@router.delete("")
def clear_demo(db: Session = Depends(get_db)) -> dict:
    cleared = demo_service.clear(db)
    return {"cleared": cleared}
