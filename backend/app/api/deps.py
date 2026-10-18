from __future__ import annotations

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.errors import ApiError


async def read_upload(file: UploadFile) -> bytes:
    """Read at most the configured limit, then reject rather than buffering more."""
    settings = get_settings()
    limit = settings.max_upload_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise ApiError(
            413,
            "file_too_large",
            f"That image is larger than the {limit / 1_000_000:.0f} MB limit.",
        )
    if not data:
        raise ApiError(422, "empty_file", "That file is empty. Please choose an image.")
    return data
