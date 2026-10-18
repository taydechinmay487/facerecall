from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_NAME = 120
MAX_RELATIONSHIP = 80
MAX_WHERE_MET = 200
MAX_ORG = 120
MAX_NOTES = 2000
MAX_REMINDER = 200

TEXT = Annotated[str, Field(max_length=MAX_NOTES)]


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = " ".join(value.split()).strip()
    return stripped or None


class PersonCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=MAX_NAME)
    relationship: str | None = Field(default=None, max_length=MAX_RELATIONSHIP)
    where_met: str | None = Field(default=None, max_length=MAX_WHERE_MET)
    organization_or_group: str | None = Field(default=None, max_length=MAX_ORG)
    notes: str | None = Field(default=None, max_length=MAX_NOTES)
    reminder: str | None = Field(default=None, max_length=MAX_REMINDER)

    consent_confirmed: bool = Field(
        default=False,
        description="Must be true: the person has agreed to their face data being stored.",
    )
    is_demo: bool = Field(
        default=False,
        description="Internal/demo use only. Demo profiles are never matched in real mode.",
    )

    @field_validator("relationship", "where_met", "organization_or_group", "reminder")
    @classmethod
    def _trim_short(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("notes")
    @classmethod
    def _trim_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("A name is required.")
        return cleaned

    @model_validator(mode="after")
    def _consent_required(self) -> "PersonCreate":
        if not self.consent_confirmed:
            raise ValueError(
                "Consent is required before a person can be enrolled. "
                "Only add people who have agreed to have their face data stored."
            )
        return self


class PersonUpdate(BaseModel):
    """Partial update. Consent is intentionally not editable here."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=MAX_NAME)
    relationship: str | None = Field(default=None, max_length=MAX_RELATIONSHIP)
    where_met: str | None = Field(default=None, max_length=MAX_WHERE_MET)
    organization_or_group: str | None = Field(default=None, max_length=MAX_ORG)
    notes: str | None = Field(default=None, max_length=MAX_NOTES)
    reminder: str | None = Field(default=None, max_length=MAX_REMINDER)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("A name is required.")
        return cleaned

    @field_validator("relationship", "where_met", "organization_or_group", "reminder")
    @classmethod
    def _trim_short(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("notes")
    @classmethod
    def _trim_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @model_validator(mode="before")
    @classmethod
    def _reject_consent(cls, data: object) -> object:
        if isinstance(data, dict) and "consent_status" in data:
            raise ValueError(
                "Consent cannot be edited silently. Use the withdraw-consent action, "
                "which also deletes the stored face data."
            )
        return data


class EnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    person_profile_id: int
    model_name: str
    model_version: str
    preprocessing_version: str
    embedding_dim: int
    quality_score: float | None = None
    has_thumbnail: bool = False
    created_at: datetime
    is_demo: bool = False


class PersonRead(BaseModel):
    id: int
    name: str
    relationship: str | None = None
    where_met: str | None = None
    organization_or_group: str | None = None
    notes: str | None = None
    reminder: str | None = None
    consent_status: bool
    consent_recorded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    is_demo: bool = False
    enrollment_count: int = 0
    avatar_url: str | None = None
    last_confirmed_interaction_at: datetime | None = None
    context_fields_completed: int = 0
    context_fields_total: int = 4


class PersonDetail(PersonRead):
    enrollments: list[EnrollmentRead] = Field(default_factory=list)
    interaction_count: int = 0


class ConsentWithdrawResult(BaseModel):
    person_id: int
    consent_status: bool
    enrollments_deleted: int
    message: str
