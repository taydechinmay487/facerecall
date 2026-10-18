from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import read_upload
from app.core.security import rate_limit_recognition
from app.database.session import get_db
from app.recognition import pipeline
from app.recognition.demo import demo_recognize
from app.schemas.recognition import RecognitionResult
from app.services import settings_service

router = APIRouter(prefix="/recognition", tags=["recognition"])


@router.post(
    "/match",
    response_model=RecognitionResult,
    dependencies=[Depends(rate_limit_recognition)],
)
async def match_frame(
    file: UploadFile = File(..., description="A single camera frame (JPEG/PNG/WebP)."),
    db: Session = Depends(get_db),
) -> RecognitionResult:
    """Compare one frame against the enrolled (real) dataset.

    Returns a structured decision. Only `accepted_match` carries a person; the
    browser must still ask the user to confirm before anything is recorded.
    """
    data = await read_upload(file)
    settings_row = settings_service.get_or_create(db)
    return pipeline.recognize_upload(
        db, data, file.filename, file.content_type, settings_row
    )


@router.post("/demo", response_model=RecognitionResult)
def match_demo(db: Session = Depends(get_db)) -> RecognitionResult:
    """Simulated result from the fictional demo dataset. No image is analysed."""
    return demo_recognize(db)
