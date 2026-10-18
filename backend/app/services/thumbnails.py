"""Thumbnail storage.

Filenames are generated server-side (uuid4 hex + .jpg), so no user-supplied
path ever reaches the filesystem. The original enrolment photo is never written
to disk -- only this small preview and the embedding.
"""

from __future__ import annotations

import re
import uuid

from app.core.config import get_settings

_SAFE_NAME = re.compile(r"^[a-f0-9]{32}\.jpg$")


def thumbnail_dir():
    settings = get_settings()
    path = settings.data_dir / "thumbnails"
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_thumbnail(data: bytes) -> str:
    name = f"{uuid.uuid4().hex}.jpg"
    (thumbnail_dir() / name).write_bytes(data)
    return name


def thumbnail_path(filename: str | None):
    """Resolve a stored filename, rejecting anything that is not ours."""
    if not filename or not _SAFE_NAME.match(filename):
        return None
    candidate = (thumbnail_dir() / filename).resolve()
    if candidate.parent != thumbnail_dir().resolve():
        return None
    return candidate if candidate.is_file() else None


def delete_thumbnail(filename: str | None) -> bool:
    path = thumbnail_path(filename)
    if path is None:
        return False
    try:
        path.unlink()
        return True
    except OSError:
        return False


def delete_all_thumbnails() -> int:
    removed = 0
    for path in thumbnail_dir().glob("*.jpg"):
        try:
            path.unlink()
            removed += 1
        except OSError:
            continue
    return removed
