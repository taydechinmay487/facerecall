# FaceRecall API

Base path: `/api/v1`. Interactive OpenAPI docs: `http://127.0.0.1:8000/api/v1/docs`
(schema at `/api/v1/openapi.json`).

## Conventions

- **Errors** always use one envelope:
  ```json
  { "error": { "code": "person_not_found", "message": "That person is not in your directory.", "details": {} } }
  ```
  Validation failures use `code: "validation_error"` with
  `details.fields = [{ "field": "name", "message": "A name is required." }]`.
- **Status codes**: 200 read/update, 201 create, 400 bad request, 401 unauthenticated, 403 forbidden,
  404 missing, 409 conflicting state (e.g. consent missing, enrolment limit), 413 file too large,
  422 validation/unsupported media, 429 rate limited, 503 engine unavailable, 500 unexpected.
- **Auth**: none by default (single-user local prototype). If `FACERECALL_API_TOKEN` is set, every
  request needs `Authorization: Bearer <token>`.
- **Caching**: API responses carry `Cache-Control: no-store`; avatars are `private, max-age=60`.
- **No biometric data in URLs or logs.** Logs contain method, path, status, duration and decision
  counts only.

## System

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness: `status`, `database`, `engine_ready`, `version` |
| GET | `/status` | Engine mode/models, database backend, encryption state, limits, privacy flags |
| GET | `/dashboard` | Aggregates computed from stored rows (people, complete context, interactions, recent lists) |
| GET | `/export` | Downloadable JSON of profiles, interactions, settings and base64 embeddings |
| DELETE | `/data` | Delete everything; body must be `{"confirm_text": "DELETE ALL", "include_demo": false}` |

## People

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/people` | List with `q`, `relationship`, `sort=name\|recent`, `dataset=real\|demo`, `limit`, `offset`; returns `items`, `total`, `relationships` |
| POST | `/people` | Create a profile. `consent_confirmed` must be `true`; `consent_recorded_at` is set server-side |
| GET | `/people/{id}` | Profile detail with enrolment metadata and interaction count |
| PATCH | `/people/{id}` | Update context fields. Sending `consent_status` is rejected — consent changes go through the endpoint below |
| DELETE | `/people/{id}` | Delete profile, enrolments, previews and interactions |
| GET | `/people/{id}/avatar` | Stored JPEG preview (404 when previews are disabled or absent) |
| POST | `/people/{id}/enroll` | Multipart `file`: validate → detect exactly one face → embed → store embedding + preview |
| DELETE | `/people/{id}/enrollments/{eid}` | Remove one enrolment (embedding + preview) |
| POST | `/people/{id}/consent/withdraw` | Withdraw consent and delete all linked biometric records |

Enrolment responses report the embedding dimension and the model/preprocessing versions stored with
the row. The vector itself is never returned by any endpoint.

## Recognition

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/recognition/match` | Multipart `file`: one frame analysed against the real dataset. Rate limited when enabled |
| POST | `/recognition/demo` | Simulated result from the fictional demo dataset. No image is analysed; response sets `mode: "demo"` and `is_simulated: true` |

Response shape:

```json
{
  "decision": "accepted_match",
  "explanation": "Match accepted: this face met your acceptance threshold and no other enrolled person was nearly as close.",
  "person": { "id": 1, "name": "…", "relationship": "…", "where_met": "…", "notes": "…",
              "reminder": "…", "avatar_url": "/api/v1/people/1/avatar",
              "last_confirmed_interaction_at": null, "enrollment_count": 2 },
  "diagnostics": { "threshold": 0.45, "ambiguity_margin": 0.05, "best_score": 0.62,
                   "second_best_score": 0.2, "best_minus_second": 0.42,
                   "candidates_considered": 1, "face_quality": 0.93, "faces_detected": 1 },
  "processing_ms": 22.1,
  "model_name": "SFace", "model_version": "2021dec",
  "preprocessing_version": "yunet-2023mar+sface-align-v1",
  "mode": "real", "is_simulated": false, "guidance": null
}
```

`diagnostics` exists for debugging and threshold tuning. Raw cosine similarity is **not** a
probability, and no endpoint presents it as a confidence percentage.

## Interactions

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/interactions` | List confirmed interactions; filters `person_id`, `start`, `end`, `limit`, `offset` |
| POST | `/interactions` | Create a confirmed entry (`event_source`: `manual` or `recognition_assisted`) |
| PATCH | `/interactions/{id}` | Correct the timestamp, note, or confirmation status |
| DELETE | `/interactions/{id}` | Delete one entry |
| DELETE | `/interactions` | Clear all history, or one person's with `?person_id=` |

There is no endpoint that records an interaction without explicit user action, and demo profiles
reject interaction writes (`demo_read_only`).

## Settings

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/settings` | Recognition threshold, ambiguity margin, frame interval, voice, display, retention |
| PATCH | `/settings` | Update any subset; ranges validated (threshold 0.05–0.99, margin 0–0.5, interval 150–10000 ms, speech rate 0.5–2, text scale 0.85–1.5) |
| GET | `/settings/diagnostics` | Engine state plus current thresholds and a reminder that scores are not probabilities |

## Demo dataset

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/demo/seed` | Create the four fictional demo profiles (idempotent) |
| DELETE | `/demo` | Remove the demo profiles |

## Upload rules

- Accepted types: `image/jpeg`, `image/png`, `image/webp` (validated by content type and extension).
- Maximum bytes: `FACERECALL_MAX_UPLOAD_BYTES` (default 8 MB) — exceeded requests get 413.
- Maximum pixels: `FACERECALL_MAX_IMAGE_PIXELS` (default 20 M).
- Filenames are never used as filesystem paths; stored previews are server-generated
  `uuid4().hex + ".jpg"` names, and any other name resolves to `None`.
