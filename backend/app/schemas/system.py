from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.interaction import InteractionRead
from app.schemas.person import PersonRead


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    engine_ready: bool
    version: str


class EngineStatus(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    mode: Literal["real", "unavailable"]
    detector_name: str
    model_name: str
    model_version: str
    embedding_dim: int | None = None
    similarity_metric: str = "cosine"
    models_present: bool = False
    message: str


class StatusOut(BaseModel):
    app_version: str
    app_env: str
    engine: EngineStatus
    demo_mode_available: bool = True
    database_backend: str
    encryption_enabled: bool
    auth_required: bool
    single_user: bool = True
    limits: dict[str, Any]
    privacy: dict[str, Any]


class DashboardSummary(BaseModel):
    total_people: int
    people_with_complete_context: int
    total_enrollments: int
    total_interactions: int
    interactions_last_30_days: int
    recent_people: list[PersonRead] = Field(default_factory=list)
    recent_interactions: list[InteractionRead] = Field(default_factory=list)
    demo_people: int = 0
    first_use: bool = False


class DataDeletionRequest(BaseModel):
    confirm_text: str = Field(
        description='Must be exactly "DELETE ALL" to proceed.',
        examples=["DELETE ALL"],
    )
    include_demo: bool = False


class DataDeletionResult(BaseModel):
    deleted_people: int
    deleted_interactions: int
    deleted_enrollments: int
    deleted_files: int
    settings_reset: bool
    message: str


class ExportBundle(BaseModel):
    exported_at: datetime
    app_version: str
    warning: str
    people: list[dict[str, Any]]
    interactions: list[dict[str, Any]]
    settings: dict[str, Any]
