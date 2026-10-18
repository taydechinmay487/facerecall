# FaceRecall architecture

FaceRecall is a local-first, single-user assistive application. A React frontend talks to a
FastAPI backend that owns the database, the recognition pipeline and every privacy control.

```
Browser (React + Vite, port 5173)
  |  camera frame (JPEG, on demand)            REST /api/v1/*
  v
FastAPI (uvicorn, port 8000)
  ├─ api/v1/*          routes, validation, error envelope
  ├─ services/*        people, enrolments, interactions, settings, export, demo, thumbnails
  ├─ recognition/*     imaging, engine adapters, matching, pipeline, demo
  └─ database/*        SQLAlchemy 2 session + schema creation
        |
        v
  SQLite file + thumbnails directory (backend/data/)
```

## Backend layers

| Layer | Module | Responsibility |
| --- | --- | --- |
| Configuration | `app/core/config.py` | Pydantic settings from env vars / `backend/.env`, path + limit validation |
| Errors | `app/core/errors.py` | One error envelope, validation mapping, no internal detail leakage |
| Crypto | `app/core/crypto.py` | Optional Fernet encryption of stored embeddings |
| Security | `app/core/security.py` | Optional bearer token, in-memory rate limiter |
| Models | `app/models/*` | SQLAlchemy ORM with constraints, indexes and cascade deletes |
| Schemas | `app/schemas/*` | Pydantic request/response contracts, field limits, consent rules |
| Services | `app/services/*` | Business rules; the only place that writes to the database |
| Recognition | `app/recognition/*` | Image validation, detection, embedding, matching, orchestration |
| API | `app/api/v1/*` | HTTP surface, upload bounds, status codes |

## Recognition pipeline

`app/recognition/pipeline.py` orchestrates the stages and is the only place that can produce a
person. Each stage is a separate module so a failure cannot silently become an identification.

1. **Frame validation** (`imaging.validate_upload_meta`, `imaging.decode_image`): content type,
   extension, byte limit, decodable image, minimum size, maximum pixel count.
2. **Quality gate** (`imaging.assess_quality`): Laplacian-variance sharpness and mean brightness;
   dark or blurry frames return `processing_error` with guidance instead of a guess.
3. **Detection** (`opencv_engine.OpenCVFaceEngine.detect`): OpenCV YuNet.
4. **Face count policy**: zero faces → `no_face_detected`; more than one → `multiple_faces_detected`.
   FaceRecall never picks one person out of a group silently.
5. **Alignment + embedding** (`OpenCVFaceEngine.embed`): SFace `alignCrop` then `feature`, L2-normalised
   to a 128-D vector.
6. **Candidate comparison** (`pipeline.load_vectors` → `matching.rank_candidates`): cosine similarity
   against enrolled vectors of the *same* dataset, filtered by matching
   `model_name`/`model_version`/`preprocessing_version`. Incompatible rows are skipped, not guessed at.
7. **Decision** (`matching.decide`): threshold, then optional ambiguity margin; deterministic
   tie-break by ascending `person_id`.
8. **Context lookup** (`pipeline.person_context`): name, relationship, where met, group, notes,
   reminder, last **confirmed** interaction.
9. **Response**: structured decision plus diagnostics for debugging. The frontend never renders
   the raw score as a percentage of certainty.

## Decision outcomes

| Decision | When | Person attached |
| --- | --- | --- |
| `accepted_match` | best ≥ threshold and (margin disabled or best − second ≥ margin) | yes |
| `unknown_person` | best < threshold, or nothing enrolled | no |
| `not_confident` | two candidates within the ambiguity margin | no |
| `no_face_detected` | detector returned nothing | no |
| `multiple_faces_detected` | more than one face in frame | no |
| `processing_error` | unusable frame (corrupt, dark, blurry, wrong type) | no |

## Data flow guarantees

- A recognition response never writes to the database. `POST /api/v1/interactions` is the only
  writer of interaction history, and it requires an explicit user confirmation.
- Demo data (`is_demo = 1`) lives in its own dataset. Real matching loads only `is_demo = false`
  rows; the demo endpoint never touches real vectors and never analyses an image.
- Deleting a person cascades to enrolments and interactions (`ON DELETE CASCADE`, enforced with
  `PRAGMA foreign_keys=ON` on SQLite) and removes thumbnail files from disk.

## Frontend structure

| Area | Path | Notes |
| --- | --- | --- |
| Layouts | `src/layouts/` | `PublicLayout` (landing, privacy, about, docs) and `AppLayout` (sidebar shell + mobile drawer) |
| Pages | `src/pages/` | One module per route; all data comes from the API |
| Components | `src/components/ui/`, `src/components/app/` | Small accessible primitives (button, field, dialog, switch, toast, badges) and composites |
| Hooks | `src/hooks/` | `useAsync` (cancellable fetch), `useSettings` (also applies display prefs), `useDemoMode`, `useCamera`, `useSpeech` |
| Services | `src/services/` | Typed wrappers over the API endpoints |
| Types | `src/types/api.ts` | Mirrors of the backend Pydantic schemas |

State that must survive navigation lives in the two providers (`SettingsProvider`,
`DemoModeProvider`); everything else is fetched per route with request cancellation on unmount.

## Formatting and time

Timestamps are stored as timezone-aware UTC (`DateTime(timezone=True)`). SQLite does not preserve
tzinfo, so values read back are normalised to UTC in the service layer before serialisation, and
the frontend formats them with `Intl.DateTimeFormat` in the viewer's locale.

## Configuration surface

All backend configuration is environment-driven (`FACERECALL_*`, see `backend/.env.example`).
User-facing preferences (threshold, margin, frame interval, voice, display, retention) live in the
single-row `app_settings` table so they can change at runtime without a restart.
