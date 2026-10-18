from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recognition_threshold: float
    ambiguity_margin: float
    frame_interval_ms: int
    voice_enabled: bool
    speech_rate: float
    speech_voice: str | None = None
    text_scale: float
    reduce_motion: bool
    retain_thumbnails: bool
    retain_interaction_history: bool
    updated_at: datetime


class SettingsUpdate(BaseModel):
    recognition_threshold: float | None = Field(default=None, ge=0.05, le=0.99)
    ambiguity_margin: float | None = Field(default=None, ge=0.0, le=0.5)
    frame_interval_ms: int | None = Field(default=None, ge=150, le=10_000)
    voice_enabled: bool | None = None
    speech_rate: float | None = Field(default=None, ge=0.5, le=2.0)
    speech_voice: str | None = Field(default=None, max_length=160)
    text_scale: float | None = Field(default=None, ge=0.85, le=1.5)
    reduce_motion: bool | None = None
    retain_thumbnails: bool | None = None
    retain_interaction_history: bool | None = None
