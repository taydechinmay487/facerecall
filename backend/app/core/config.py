"""Application configuration.

All values come from environment variables (optionally from `backend/.env`),
so no secrets or machine-specific paths live in source control.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
APP_VERSION = "0.1.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FACERECALL_",
        env_file=(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    app_env: str = "development"
    app_version: str = APP_VERSION

    database_url: str = "sqlite:///./data/facerecall.db"
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    data_dir: Path = Field(default=Path("./data"))
    model_dir: Path = Field(default=Path("./models"))

    recognition_threshold: float = 0.45
    ambiguity_margin: float = 0.05
    frame_interval_ms: int = 600

    max_upload_bytes: int = 8_000_000
    max_image_pixels: int = 20_000_000

    encryption_key: str = ""
    api_token: str = ""

    enable_rate_limit: bool = False
    rate_limit_per_minute: int = 60

    # Upload policy: enrolment photos are converted to a small thumbnail and an
    # embedding; the original file is not retained.
    thumbnail_max_edge: int = 320

    @field_validator("recognition_threshold")
    @classmethod
    def _threshold_range(cls, value: float) -> float:
        if not 0.05 <= value <= 0.99:
            raise ValueError("recognition threshold must be between 0.05 and 0.99")
        return value

    @field_validator("ambiguity_margin")
    @classmethod
    def _margin_range(cls, value: float) -> float:
        if not 0.0 <= value <= 0.5:
            raise ValueError("ambiguity margin must be between 0.0 and 0.5")
        return value

    @field_validator("frame_interval_ms")
    @classmethod
    def _interval_range(cls, value: int) -> int:
        if not 150 <= value <= 10_000:
            raise ValueError("frame interval must be between 150 and 10000 ms")
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def is_local_only(self) -> bool:
        return not self.api_token

    def ensure_directories(self) -> None:
        for path in (self.data_dir, self.data_dir / "thumbnails", self.model_dir):
            path.mkdir(parents=True, exist_ok=True)

    def resolve_database_url(self) -> str:
        """Resolve relative SQLite paths against the backend directory."""
        url = self.database_url
        if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
            raw = url[len("sqlite:///") :]
            if raw and raw != ":memory:":
                path = Path(raw)
                if not path.is_absolute():
                    path = (BACKEND_ROOT / path).resolve()
                path.parent.mkdir(parents=True, exist_ok=True)
                return f"sqlite:///{path.as_posix()}"
        return url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings
