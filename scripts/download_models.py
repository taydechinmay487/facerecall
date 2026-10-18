#!/usr/bin/env python3
"""Download the pretrained face models used by FaceRecall.

Models (OpenCV Model Zoo):
  * face_detection_yunet_2023mar.onnx      - MIT
  * face_recognition_sface_2021dec.onnx    - Apache-2.0

Usage (from the repository root):
    python scripts/download_models.py

Writes to backend/models/ by default (override with FACERECALL_MODEL_DIR).
If the download returns a Git LFS pointer, the script explains how to fetch the
real file instead of silently writing a broken model.
"""

from __future__ import annotations

import hashlib
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = ROOT / "backend" / "models"

# OpenCV Zoo stores these weights with Git LFS, so the media endpoint returns the
# real file while the plain raw URL returns an LFS pointer.
FILES = {
    "face_detection_yunet_2023mar.onnx": (
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
        "face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "MIT",
    ),
    "face_recognition_sface_2021dec.onnx": (
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
        "face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "Apache-2.0",
    ),
}


def looks_like_lfs_pointer(data: bytes) -> bool:
    return data[:40].startswith(b"version https://git-lfs")


def looks_like_onnx(data: bytes) -> bool:
    """ONNX files are protobuf: they start with a field tag, not text."""
    return len(data) > 2 and data[0] in (0x08, 0x0A, 0x12, 0x1A) and not data[:1].isalpha()


def download(url: str, target: Path) -> None:
    print(f"  downloading {url}")
    with urllib.request.urlopen(url, timeout=300) as response:
        data = response.read()
    if looks_like_lfs_pointer(data):
        raise SystemExit(
            "The server returned a Git LFS pointer instead of the model file.\n"
            "Fetch the real weights with one of:\n"
            "  git lfs install && git clone https://github.com/opencv/opencv_zoo\n"
            "  then copy models/face_detection_yunet/*.onnx and "
            "models/face_recognition_sface/*.onnx into backend/models/\n"
            "Alternatively download them from the OpenCV Zoo release page."
        )
    if len(data) < 100_000:
        raise SystemExit(f"Downloaded file is suspiciously small ({len(data)} bytes).")
    if not looks_like_onnx(data):
        raise SystemExit(
            "Downloaded file does not look like an ONNX model. Check the URL or download it "
            "manually from the OpenCV Model Zoo."
        )
    target.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    print(f"  saved {target.name} ({len(data) / 1_000_000:.1f} MB) sha256={digest}")


def main() -> int:
    target_dir = Path(os.environ.get("FACERECALL_MODEL_DIR", DEFAULT_DIR))
    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"FaceRecall model setup -> {target_dir}")
    for name, (url, licence) in FILES.items():
        target = target_dir / name
        if target.is_file() and target.stat().st_size > 100_000:
            print(f"  {name} already present (licence: {licence})")
            continue
        print(f"Fetching {name} (licence: {licence})")
        try:
            download(url, target)
        except SystemExit:
            raise
        except Exception as exc:  # noqa: BLE001
            print(f"  failed: {exc}")
            print(
                "  Fix: download the file manually from the OpenCV Model Zoo and place it "
                f"in {target_dir}."
            )
            return 1
    print("Done. Real recognition mode activates on the next backend restart.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
