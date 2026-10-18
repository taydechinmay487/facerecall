"""Real recognition engine: OpenCV YuNet detector + SFace embedder.

Both models come from the OpenCV Model Zoo and are used through OpenCV's own
inference wrappers, so no extra runtime is required:

* face_detection_yunet_2023mar.onnx  (MIT licence)
* face_recognition_sface_2021dec.onnx (Apache-2.0, part of OpenCV Zoo)

SFace emits a 128-D embedding; comparisons use cosine similarity, which is the
metric the model was trained with. See docs/model-and-licence-notes.md.
"""

from __future__ import annotations

import logging
import threading

import numpy as np

from app.core.config import get_settings
from app.recognition.engine_base import (
    DetectedFace,
    EmbeddedFace,
    EngineUnavailable,
    to_float32_vector,
)

logger = logging.getLogger("facerecall.engine")

DETECTOR_FILENAME = "face_detection_yunet_2023mar.onnx"
RECOGNISER_FILENAME = "face_recognition_sface_2021dec.onnx"


class OpenCVFaceEngine:
    name = "SFace"
    detector_name = "YuNet"
    version = "2021dec"
    preprocessing_version = "yunet-2023mar+sface-align-v1"
    embedding_dim = 128
    similarity_metric = "cosine"

    def __init__(self) -> None:
        self._detector = None
        self._recogniser = None
        self._lock = threading.Lock()

    # -- paths -----------------------------------------------------------
    @property
    def detector_path(self):
        return get_settings().model_dir / DETECTOR_FILENAME

    @property
    def recogniser_path(self):
        return get_settings().model_dir / RECOGNISER_FILENAME

    @property
    def models_present(self) -> bool:
        return self.detector_path.is_file() and self.recogniser_path.is_file()

    @property
    def ready(self) -> bool:
        return self.models_present and self._detector is not None and self._recogniser is not None

    # -- lifecycle -------------------------------------------------------
    def load(self) -> None:
        if self.ready:
            return
        if not self.models_present:
            raise EngineUnavailable(
                "Face models are not installed. Run `python scripts/download_models.py` "
                "from the repository root, or keep using demo mode."
            )
        with self._lock:
            if self.ready:
                return
            try:
                import cv2
            except ImportError as exc:  # pragma: no cover - dependency guard
                raise EngineUnavailable(
                    "OpenCV is not installed. Run `pip install -r backend/requirements.txt`."
                ) from exc

            detector = cv2.FaceDetectorYN.create(
                str(self.detector_path), "", (320, 320), 0.85, 0.3, 5000
            )
            recogniser = cv2.FaceRecognizerSF.create(str(self.recogniser_path), "")
            if detector is None or recogniser is None:
                raise EngineUnavailable("OpenCV could not load the face model files.")
            self._detector = detector
            self._recogniser = recogniser
            logger.info(
                "Loaded face models: detector=%s recogniser=%s v%s",
                self.detector_name,
                self.name,
                self.version,
            )

    # -- inference -------------------------------------------------------
    def detect(self, image: np.ndarray) -> list[DetectedFace]:
        if not self.ready:
            self.load()
        height, width = image.shape[:2]
        assert self._detector is not None
        self._detector.setInputSize((width, height))
        _, faces = self._detector.detect(image)
        if faces is None:
            return []
        results: list[DetectedFace] = []
        for row in faces:
            x, y, w, h = (float(v) for v in row[:4])
            confidence = float(row[14]) if row.shape[0] > 14 else 0.0
            landmarks = [
                (float(row[4 + i * 2]), float(row[5 + i * 2])) for i in range(5)
            ]
            results.append(
                DetectedFace(
                    box=(int(x), int(y), int(w), int(h)),
                    confidence=confidence,
                    payload=row,
                    landmarks=landmarks,
                )
            )
        return results

    def embed(self, image: np.ndarray, face: DetectedFace) -> EmbeddedFace:
        if not self.ready:
            self.load()
        assert self._recogniser is not None
        try:
            aligned = self._recogniser.alignCrop(image, face.payload)
            raw = self._recogniser.feature(aligned)
        except Exception as exc:  # OpenCV raises cv2.error on odd crops
            raise EngineUnavailable(
                "The face could not be read clearly. Please try again with more light "
                "and your face fully in frame."
            ) from exc
        vector = to_float32_vector(raw, self.embedding_dim)
        return EmbeddedFace(vector=vector, quality=float(face.confidence))
