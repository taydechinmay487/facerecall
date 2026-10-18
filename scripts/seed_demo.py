#!/usr/bin/env python3
"""Seed or clear the fictional demo dataset.

Usage (from the repository root):
    python scripts/seed_demo.py seed
    python scripts/seed_demo.py clear

Demo profiles are marked is_demo and are never used by real recognition.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.database.session import SessionLocal, init_db  # noqa: E402
from app.services import demo_service  # noqa: E402


def main(argv: list[str]) -> int:
    action = argv[1] if len(argv) > 1 else "seed"
    init_db()
    with SessionLocal() as db:
        if action == "seed":
            created = demo_service.seed(db)
            print(f"Seeded {created} demo profile(s)." if created else "Demo data already present.")
        elif action == "clear":
            cleared = demo_service.clear(db)
            print(f"Removed {cleared} demo profile(s).")
        else:
            print("Usage: python scripts/seed_demo.py [seed|clear]")
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
