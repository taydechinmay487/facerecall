from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import encryption_enabled
from app.core.errors import ApiError
from app.database.session import get_db
from app.recognition import pipeline
from app.recognition.imaging import ALLOWED_CONTENT_TYPES
from app.schemas.system import (
    DashboardSummary,
    DataDeletionRequest,
    DataDeletionResult,
    ExportBundle,
    HealthOut,
    StatusOut,
)
from app.services import dashboard_service, export_service, settings_service

logger = logging.getLogger("facerecall.system")
router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthOut)
def health(db: Session = Depends(get_db)) -> HealthOut:
    database = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        database = "unavailable"
    settings = get_settings()
    engine = pipeline.engine_status()
    return HealthOut(
        status="ok" if database == "ok" else "degraded",
        database=database,  # type: ignore[arg-type]
        engine_ready=engine.mode == "real",
        version=settings.app_version,
    )


@router.get("/status", response_model=StatusOut)
def status(db: Session = Depends(get_db)) -> StatusOut:
    settings = get_settings()
    preferences = settings_service.get_or_create(db)
    engine = pipeline.engine_status()
    backend = "sqlite" if settings.resolve_database_url().startswith("sqlite") else "postgresql"
    return StatusOut(
        app_version=settings.app_version,
        app_env=settings.app_env,
        engine=engine,
        demo_mode_available=True,
        database_backend=backend,
        encryption_enabled=encryption_enabled(),
        auth_required=bool(settings.api_token.strip()),
        single_user=True,
        limits={
            "max_upload_bytes": settings.max_upload_bytes,
            "max_enrollments_per_person": 3,
            "accepted_content_types": sorted(ALLOWED_CONTENT_TYPES),
        },
        privacy={
            "raw_images_retained": False,
            "thumbnails_retained": preferences.retain_thumbnails,
            "camera_video_retained": False,
            "processing": "local server process on this machine",
            "embeddings_are_biometric": True,
        },
    )


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(db: Session = Depends(get_db)) -> DashboardSummary:
    return dashboard_service.summary(db)


@router.get("/export", response_model=ExportBundle)
def export_data(db: Session = Depends(get_db)) -> JSONResponse:
    payload = export_service.build_export(db)
    body = ExportBundle(**payload).model_dump(mode="json")
    filename = f"facerecall-export-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.json"
    logger.info("Data export generated")
    return JSONResponse(
        content=body,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.delete("/data", response_model=DataDeletionResult)
def delete_all_data(
    payload: DataDeletionRequest, db: Session = Depends(get_db)
) -> DataDeletionResult:
    if payload.confirm_text != "DELETE ALL":
        raise ApiError(
            400,
            "confirmation_required",
            'Type "DELETE ALL" exactly to confirm. Nothing was deleted.',
        )
    result = export_service.delete_all(db, include_demo=payload.include_demo)
    logger.warning(
        "User deleted all data: people=%s interactions=%s enrolments=%s",
        result["deleted_people"],
        result["deleted_interactions"],
        result["deleted_enrollments"],
    )
    return DataDeletionResult(**result)
