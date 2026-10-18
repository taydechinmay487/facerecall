#!/usr/bin/env python3
"""Opt-in integration check for the *real* recognition pipeline.

This runs the full API flow (consent -> profile -> enrol -> match) against a
temporary database and data directory, using the installed YuNet + SFace models.
Nothing is written to your normal FaceRecall data directory.

Usage (from the repository root, after `python scripts/download_models.py`):

    backend\\.venv\\Scripts\\python.exe scripts/verify_real_pipeline.py ^
        --enrol path\\to\\person_a.jpg --same path\\to\\person_a_other.jpg ^
        --other path\\to\\someone_else.jpg

Use images you have the right to process. The script never stores the images:
only an embedding and a small preview, both inside the temporary directory it
deletes on exit. It prints raw cosine similarities for diagnostics; those are
observations about the images you supplied, not an accuracy measurement.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enrol", required=True, type=Path)
    parser.add_argument("--same", type=Path, help="Another photo of the same person.")
    parser.add_argument("--other", type=Path, help="A photo of a different person.")
    parser.add_argument("--threshold", type=float, default=0.45)
    args = parser.parse_args()

    workdir = Path(tempfile.mkdtemp(prefix="facerecall-verify-"))
    os.environ["FACERECALL_DATA_DIR"] = str(workdir)
    os.environ["FACERECALL_DATABASE_URL"] = f"sqlite:///{(workdir / 'verify.db').as_posix()}"
    os.environ["FACERECALL_MODEL_DIR"] = str(BACKEND / "models")

    from fastapi.testclient import TestClient  # imported after env setup

    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.database.session import init_db  # noqa: E402
    from app.main import create_app  # noqa: E402

    init_db()
    client = TestClient(create_app())
    failures: list[str] = []

    try:
        status = client.get("/api/v1/status").json()
        print(f"engine mode            : {status['engine']['mode']}")
        print(f"detector / model       : {status['engine']['detector_name']} / "
              f"{status['engine']['model_name']} {status['engine']['model_version']} "
              f"({status['engine']['embedding_dim']}-D, {status['engine']['similarity_metric']})")
        if status["engine"]["mode"] != "real":
            print("Models are not installed; run scripts/download_models.py first.")
            return 2

        client.patch("/api/v1/settings", json={"recognition_threshold": args.threshold})

        created = client.post(
            "/api/v1/people",
            json={"name": "Verification Subject A", "consent_confirmed": True},
        )
        if created.status_code != 201:
            print(f"profile creation failed: {created.status_code} {created.text}")
            return 1
        person_id = created.json()["id"]

        with args.enrol.open("rb") as handle:
            enrolled = client.post(
                f"/api/v1/people/{person_id}/enroll",
                files={"file": (args.enrol.name, handle, "image/jpeg")},
            )
        print(f"enrol status           : {enrolled.status_code}")
        if enrolled.status_code != 201:
            print(enrolled.text)
            return 1

        with args.enrol.open("rb") as handle:
            same_file = client.post(
                "/api/v1/recognition/match",
                files={"file": ("same.jpg", handle, "image/jpeg")},
            ).json()
        print(f"match (same image)     : {same_file['decision']} "
              f"best={same_file['diagnostics']['best_score']} "
              f"({same_file['processing_ms']} ms)")
        if same_file["decision"] != "accepted_match":
            failures.append("the enrolled image did not match itself")

        if args.same and args.same.exists():
            with args.same.open("rb") as handle:
                variant = client.post(
                    "/api/v1/recognition/match",
                    files={"file": ("variant.jpg", handle, "image/jpeg")},
                ).json()
            print(f"match (other photo)    : {variant['decision']} "
                  f"best={variant['diagnostics']['best_score']}")
            if variant["decision"] != "accepted_match":
                print("  note: correct behaviour if these are different people or a hard pose/lighting change.")

        if args.other and args.other.exists():
            with args.other.open("rb") as handle:
                stranger = client.post(
                    "/api/v1/recognition/match",
                    files={"file": ("other.jpg", handle, "image/jpeg")},
                ).json()
            print(f"match (different person): {stranger['decision']} "
                  f"best={stranger['diagnostics']['best_score']}")
            if stranger["decision"] != "unknown_person":
                failures.append("a different person was not rejected as unknown")

        interactions = client.get("/api/v1/interactions").json()["total"]
        print(f"history entries written: {interactions} (expected 0 until you confirm one)")
        if interactions != 0:
            failures.append("recognition wrote history without confirmation")

        deleted = client.delete(f"/api/v1/people/{person_id}").json()
        print(f"cleanup                : deleted profile with {deleted['deleted_enrollments']} enrolment(s)")

        if failures:
            print("\nFAILED CHECKS:")
            for item in failures:
                print(f" - {item}")
            return 1
        print("\nAll integration checks passed on the supplied images.")
        return 0
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
