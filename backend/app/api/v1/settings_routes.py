from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.recognition import pipeline
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
def read_settings(db: Session = Depends(get_db)) -> SettingsRead:
    return settings_service.to_read(settings_service.get_or_create(db))


@router.patch("", response_model=SettingsRead)
def patch_settings(
    payload: SettingsUpdate, db: Session = Depends(get_db)
) -> SettingsRead:
    return settings_service.to_read(settings_service.update(db, payload))


@router.get("/diagnostics")
def diagnostics(db: Session = Depends(get_db)) -> dict:
    """Engine state plus current thresholds, for the Settings -> Recognition panel."""
    row = settings_service.get_or_create(db)
    return {
        "engine": pipeline.engine_status().model_dump(),
        "thresholds": {
            "recognition_threshold": row.recognition_threshold,
            "ambiguity_margin": row.ambiguity_margin,
            "frame_interval_ms": row.frame_interval_ms,
        },
        "note": (
            "Similarity scores are not probabilities. Thresholds should be calibrated "
            "against your own evaluation set; see docs/testing-plan.md."
        ),
    }
