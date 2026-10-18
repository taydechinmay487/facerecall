from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.settings import SETTINGS_ID, AppSettings
from app.schemas.settings import SettingsRead, SettingsUpdate


def get_or_create(db: Session) -> AppSettings:
    row = db.get(AppSettings, SETTINGS_ID)
    if row is None:
        row = AppSettings(id=SETTINGS_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def to_read(row: AppSettings) -> SettingsRead:
    return SettingsRead.model_validate(row)


def update(db: Session, payload: SettingsUpdate) -> AppSettings:
    row = get_or_create(db)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def reset(db: Session) -> AppSettings:
    row = db.get(AppSettings, SETTINGS_ID)
    if row is not None:
        db.delete(row)
        db.commit()
    return get_or_create(db)
