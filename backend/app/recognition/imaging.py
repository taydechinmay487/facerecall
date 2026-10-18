"""Frame validation and decoding.

Handles: empty uploads, unsupported/undecodable images, oversized pixel
counts, and clearly unusable frames (too dark, too blurry). Every rejection is
a typed, user-explicable error rather than an exception traceback.
"""

from __future__ import annotations

import numpy as np

from app.core.config import get_settings
from app.recognition.engine_base import ImageRejected

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

MIN_SHARPNESS = 45.0
MIN_BRIGHTNESS = 32.0


def _cv2():
    import cv2  # imported lazily so the API can start without OpenCV

    return cv2


def validate_upload_meta(filename: str | None, content_type: str | None, size: int) -> None:
    settings = get_settings()
    if size <= 0:
        raise ImageRejected("empty_file", "That file is empty. Please choose an image.")
    if size > settings.max_upload_bytes:
        mb = settings.max_upload_bytes / 1_000_000
        raise ImageRejected(
            "file_too_large",
            f"That image is larger than the {mb:.0f} MB limit. Please use a smaller photo.",
        )
    if content_type and content_type.split(";")[0].strip().lower() not in ALLOWED_CONTENT_TYPES:
        raise ImageRejected(
            "unsupported_type",
            "Please use a JPEG, PNG or WebP image.",
        )
    if filename:
        lowered = filename.lower()
        if "." in lowered:
            suffix = "." + lowered.rsplit(".", 1)[1]
            if suffix not in ALLOWED_EXTENSIONS:
                raise ImageRejected("unsupported_type", "Please use a JPEG, PNG or WebP image.")


def decode_image(data: bytes) -> np.ndarray:
    """Decode bytes into a BGR uint8 array, rejecting unusable input."""
    settings = get_settings()
    cv2 = _cv2()
    if not data:
        raise ImageRejected("empty_file", "That file is empty. Please choose an image.")

    buffer = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise ImageRejected(
            "corrupt_image",
            "That image could not be read. Try a different photo (JPEG, PNG or WebP).",
        )
    height, width = image.shape[:2]
    if height < 60 or width < 60:
        raise ImageRejected(
            "image_too_small",
            "That image is too small to analyse. Please use at least 200 x 200 pixels.",
        )
    if height * width > settings.max_image_pixels:
        raise ImageRejected(
            "image_too_large",
            "That image has too many pixels. Please use a smaller photo.",
        )
    return image


def assess_quality(image: np.ndarray) -> tuple[float, str | None]:
    """Return (quality 0..1, rejection code or None) for a decoded image."""
    cv2 = _cv2()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    quality = max(0.0, min(1.0, sharpness / 180.0)) * max(0.0, min(1.0, brightness / 110.0))
    if brightness < MIN_BRIGHTNESS:
        return quality, "low_light"
    if sharpness < MIN_SHARPNESS:
        return quality, "blurry_image"
    return quality, None


def make_thumbnail(image: np.ndarray, max_edge: int) -> bytes | None:
    """Small JPEG preview for the UI. The original upload is discarded."""
    cv2 = _cv2()
    height, width = image.shape[:2]
    scale = min(1.0, max_edge / max(height, width))
    if scale < 1.0:
        image = cv2.resize(
            image,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_AREA,
        )
    ok, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
    return buffer.tobytes() if ok else None
