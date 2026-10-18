# Models, versions and licences

FaceRecall uses two pretrained models from the **OpenCV Model Zoo**, loaded through OpenCV's own
inference wrappers. There is no dlib build, no PyTorch, no ONNX Runtime and no model server.

| Role | File | Model | Licence | Size | Runtime |
| --- | --- | --- | --- | --- | --- |
| Face detection | `face_detection_yunet_2023mar.onnx` | YuNet (2023mar) | MIT | 232,589 bytes | `cv2.FaceDetectorYN` |
| Face embedding | `face_recognition_sface_2021dec.onnx` | SFace (2021dec) | Apache-2.0 | 38,696,353 bytes | `cv2.FaceRecognizerSF` |

Sources: <https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet> and
<https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface>.
Licence terms are those of the upstream repositories; OpenCV itself is Apache-2.0.

## Verified hashes (downloaded in this environment)

```
face_detection_yunet_2023mar.onnx    sha256 8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4
face_recognition_sface_2021dec.onnx  sha256 0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79
```

`scripts/download_models.py` prints the SHA-256 of whatever it downloads. Compare them with the
values above if you want to confirm you have the same weights; the script deliberately does not fail
on a mismatch, because upstream may republish files.

## Why these models

- **Documented and maintained** in the OpenCV Model Zoo, which is actively updated.
- **Permissive licences** (MIT + Apache-2.0) with no registration or approval step.
- **No extra runtime**: both load through `opencv-python-headless`, which is already required for
  image handling.
- **Metric honesty**: SFace is trained and benchmarked with **cosine similarity**, which is exactly
  what `app/recognition/matching.py` computes. No metric conversion is involved.

## Versions stored with every enrolment

Each `face_enrollments` row records:

```
model_name             = "SFace"
model_version          = "2021dec"
preprocessing_version  = "yunet-2023mar+sface-align-v1"
embedding_dim          = 128
```

Matching only compares rows whose three version fields match the running engine; anything else is
skipped and counted in a warning log (`Skipped N enrolment(s) with incompatible or unreadable
embeddings`). Replacing a model therefore requires re-enrolling everyone rather than silently mixing
incompatible vectors — the failure mode is "no candidates", which errs toward refusal.

## Preprocessing

1. Decode with `cv2.imdecode` (colour), reject non-images, < 60 px edges, or > 20 M pixels.
2. Quality gate: Laplacian variance ≥ 45 and mean brightness ≥ 32 (see `imaging.assess_quality`).
3. Detect with YuNet at the frame's own resolution (`setInputSize`), confidence ≥ 0.85, NMS 0.3.
4. Align with `FaceRecognizerSF.alignCrop` (SFace's own 112×112 alignment) — no hand-rolled
   landmarks.
5. `FaceRecognizerSF.feature` → `(1, 128)` float32, then L2-normalise so cosine similarity is a
   plain dot product.

## Thresholds

`matching.decide` applies your configured threshold (default 0.45) to the best cosine similarity and,
when configured, an ambiguity margin (default 0.05) between the best and second-best *people*.
SFace's own published LFW verification threshold is ≈ 0.363; **0.45 is a deliberately conservative
default for a small personal dataset, and it is not calibrated for your images.** Sweep it with the
protocol in `testing-plan.md`, then update `FACERECALL_RECOGNITION_THRESHOLD` or the Settings screen.

Do not present cosine similarity as a probability. It is a distance-like score whose mapping to
probability depends on the population, the images and the threshold.

## Fallbacks

**No models installed.** The API still starts. `/api/v1/status` reports `engine.mode = "unavailable"`,
the interface shows "Models not installed — demo only", and recognition requests return
`503 engine_unavailable`. Nothing silently degrades into fabricated matches.

**Demo mode.** `POST /api/v1/recognition/demo` returns a simulated match drawn from the fictional
demo dataset (four seeded profiles, synthetic pseudo-embeddings with `model_name = "demo-synthetic"`).
It performs no computer vision whatsoever and every response is marked `mode: "demo"`,
`is_simulated: true`, with the UI showing a persistent banner and a "Simulated demo match" badge.

**Download blocked or LFS pointer returned.** `scripts/download_models.py` detects Git LFS pointer
files and tells you to fetch them with `git lfs` or from the OpenCV Zoo release page. Downloading
through `https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/...` worked in this
environment; the plain `raw.githubusercontent.com` path returned pointer files.

**Swapping the model.** Implement the `FaceEngine` protocol in `app/recognition/engine_base.py`
(`detect`, `embed`, plus `name`, `detector_name`, `version`, `preprocessing_version`, `embedding_dim`,
`similarity_metric`, `ready`, `load`) and return it from `pipeline.get_engine()`. Update the
`similarity_metric` if the new model is not cosine-trained, and add its licence here.

## Alternatives considered

| Option | Why not chosen |
| --- | --- |
| `face_recognition` (dlib) | Compiling dlib on Windows/macOS needs a toolchain; model licence for the pretrained weights is less clear |
| `insightface` (ArcFace) | Strong accuracy but adds ONNX Runtime plus a ~300 MB model pack and per-model licence terms |
| `deepface` | Pulls in TensorFlow; large footprint, version conflicts, slower install |
| Cloud face APIs | Disallowed by the project's privacy requirements — biometric data must not leave the machine |
