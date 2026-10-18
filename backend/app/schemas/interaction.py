from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EventSource = Literal["manual", "recognition_assisted"]
ConfirmationStatus = Literal["confirmed", "corrected"]


class InteractionCreate(BaseModel):
    person_profile_id: int = Field(gt=0)
    occurred_at: datetime | None = Field(
        default=None, description="Defaults to now (UTC) when omitted."
    )
    event_source: EventSource = "manual"
    confirmation_status: ConfirmationStatus = "confirmed"
    user_note: str | None = Field(default=None, max_length=1000)

    @field_validator("user_note")
    @classmethod
    def _trim_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @model_validator(mode="after")
    def _no_pending_state(self) -> "InteractionCreate":
        # An interaction is only stored once a human has confirmed it. There is
        # deliberately no "unconfirmed" value that could later look like a fact.
        if self.confirmation_status not in ("confirmed", "corrected"):
            raise ValueError("Interactions must be confirmed or corrected.")
        return self


class InteractionUpdate(BaseModel):
    occurred_at: datetime | None = None
    user_note: str | None = Field(default=None, max_length=1000)
    confirmation_status: ConfirmationStatus | None = None

    @field_validator("user_note")
    @classmethod
    def _trim_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class InteractionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    person_profile_id: int
    person_name: str
    occurred_at: datetime
    event_source: EventSource
    confirmation_status: ConfirmationStatus
    user_note: str | None = None
    created_at: datetime
