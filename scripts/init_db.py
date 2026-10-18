#!/usr/bin/env python3
"""Create the database schema (idempotent).

Usage (from the repository root):
    python scripts/init_db.py

Reads FACERECALL_DATABASE_URL from backend/.env if present.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import get_settings  # noqa: E402
from app.database.session import engine, init_db  # noqa: E402


def main() -> int:
    settings = get_settings()
    init_db()
    print(f"Database ready: {settings.resolve_database_url()}")
    print(f"Dialect: {engine.dialect.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
