# FaceRecall

**Recognize familiar faces. Recall meaningful connections.**

FaceRecall is an assistive memory tool for people with **prosopagnosia** (face blindness). It
compares a face in view **only** against people you have deliberately enrolled with their consent,
and shows the context you recorded about them.

> **Recognition accuracy has not yet been evaluated.** No volunteer dataset has been collected, so
> there are no measured accuracy, false-match or latency figures. The default threshold is an
> uncalibrated starting point. See [docs/testing-plan.md](docs/testing-plan.md).

### What it is

- A local-first, single-user prototype: React + TypeScript frontend, FastAPI + SQLite backend.
- A consent-based memory aid: profile, context, notes, reminders and confirmed-interaction dates.
- Honest about uncertainty: `accepted_match`, `unknown_person`, `not_confident`, `no_face_detected`,
  `multiple_faces_detected` and `processing_error` are all first-class outcomes.

### What it is not

- Not a medical device, diagnosis, or cure for prosopagnosia.
- Not a stranger-identification, surveillance or crowd-scanning system.
- Not an accuracy claim: nothing here has been benchmarked on a real dataset yet.

---

## Verified status of this build

Measured in this environment (Windows 11, Python 3.13, Node 24). Everything below was actually run:

| Check | Result |
| --- | --- |
| Backend test suite (`pytest`) | **73 passed** (~3.4 s) |
| Frontend test suite (`vitest run`) | **29 passed** across 7 files |
| Frontend production build (`tsc --noEmit && vite build`) | **Succeeded** (≈ 330 kB JS, 25 kB CSS) |
| Frontend type check | Clean |
| Database init (`python scripts/init_db.py`) | Tables created; API reports `database: ok` |
| Real models installed (YuNet + SFace) | Both loaded in OpenCV 4.10 |
| Real API flow (consent → enrol → match → delete) | Same image → `accepted_match` (best 1.0, 22 ms); different person → `unknown_person` (best 0.130); zero history entries written without confirmation |
| Browser flow against the dev server | Profile created through the UI, rendered from live API data, deleted through the confirmation dialog; interface showed "Real recognition ready" |
| Recognition accuracy | **Not yet evaluated** — see the evaluation protocol |

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Python | 3.11–3.13 (3.13 was used here; numpy 2.x wheels are required on 3.13) |
| Node.js | 18+ (24 used here) with npm |
| OS | Windows, macOS or Linux. No compiler needed: the models run through OpenCV's own inference wrappers |
| Camera | Optional. Only needed for live recognition; a modern browser with MediaDevices |
| Disk | ~40 MB for the models, a few MB for the database and previews |

---

## Quick start

### 1. Backend

```bash
cd backend

# Windows
py -3.13 -m venv .venv
.\.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env            # Windows: copy .env.example .env
```

### 2. Pretrained models (optional, but required for real recognition)

```bash
# from the repository root
python scripts/download_models.py      # uses the venv's python
```

Downloads ~39 MB into `backend/models/`. Licences and hashes:
[docs/model-and-licence-notes.md](docs/model-and-licence-notes.md).

Without the models the app still runs: recognition returns `503 engine_unavailable`, the UI shows
"Models not installed — demo only", and demo mode remains available and clearly labelled.

### 3. Database

```bash
python scripts/init_db.py              # idempotent; creates backend/data/facerecall.db
```

The API also creates the schema on startup, so this step is optional.

### 4. Run the API

```bash
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
# macOS/Linux: .venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Check it: <http://127.0.0.1:8000/api/v1/health> · API docs: <http://127.0.0.1:8000/api/v1/docs>

### 5. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env            # Windows: copy .env.example .env
npm run dev                     # http://127.0.0.1:5173
```

Open <http://127.0.0.1:5173>, add a consenting person with 1–3 front-facing photos, then press
**Start camera** on `/recognize`.

---

## Configuration

Backend (`backend/.env`, see `backend/.env.example`) — all optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `FACERECALL_DATABASE_URL` | `sqlite:///./data/facerecall.db` | Database URL (PostgreSQL is a URL change) |
| `FACERECALL_FRONTEND_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allowlist |
| `FACERECALL_DATA_DIR` | `./data` | Database + preview images |
| `FACERECALL_MODEL_DIR` | `./models` | ONNX model directory |
| `FACERECALL_RECOGNITION_THRESHOLD` | `0.45` | Default acceptance threshold (runtime-editable in Settings) |
| `FACERECALL_AMBIGUITY_MARGIN` | `0.05` | Default best-vs-second margin (runtime-editable) |
| `FACERECALL_MAX_UPLOAD_BYTES` | `8000000` | Upload limit |
| `FACERECALL_MAX_IMAGE_PIXELS` | `20000000` | Decoded pixel limit |
| `FACERECALL_ENCRYPTION_KEY` | *(empty)* | Fernet key; encrypts stored embeddings at rest |
| `FACERECALL_API_TOKEN` | *(empty)* | Shared bearer token for non-local deployments |
| `FACERECALL_ENABLE_RATE_LIMIT` / `..._PER_MINUTE` | `false` / `60` | Rate limiting for recognition |

Generate an encryption key:
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

Frontend (`frontend/.env`): `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`) and optional
`VITE_API_TOKEN`. **Never put secrets here** — Vite inlines `VITE_*` into the bundle.

---

## Database and migrations

```bash
python scripts/init_db.py                    # create tables (SQLite by default)
python scripts/seed_demo.py seed             # optional fictional demo profiles
python scripts/seed_demo.py clear            # remove them
```

Schema creation is idempotent (`Base.metadata.create_all`). **Alembic is not wired up yet** — there
is no migration history, so schema changes mean either a fresh database or a hand-written migration.
That is an accepted limitation of this prototype, not an accident.

### Moving to PostgreSQL

1. `pip install "psycopg[binary]"` and add it to `requirements.txt`.
2. Set `FACERECALL_DATABASE_URL=postgresql+psycopg://user:password@host:5432/facerecall`.
3. Start the API once so tables are created, or run `python scripts/init_db.py`.
4. Existing SQLite data must be exported (`GET /api/v1/export`) and re-imported with a small script;
   embeddings are included in the export as base64 float32 and store as `BYTEA`.
5. Add Alembic at that point (`alembic init`, target metadata from `app.models`) so schema changes
   are versioned.

The application code is dialect-neutral: no SQLite-specific SQL, `PRAGMA foreign_keys` is only
applied for SQLite connections, and timezone-aware datetimes are normalised in the service layer.

---

## Using FaceRecall

1. **Add a person** (`/people/new`): name, relationship, where you met, group, notes, reminder, then
   tick the consent confirmation. Add 1–3 photos from your files or the camera.
2. **Start recognition** (`/recognize`): the camera stays off until you press start. Keep one face in
   view. A match shows the name, relationship, where you met, your notes, your reminder and the last
   **confirmed** interaction. Buttons: *Correct match*, *Not this person*, *View profile*, *Dismiss*.
3. **Confirming** a match opens a small form (time + optional note) and writes one interaction entry.
   Dismissing writes nothing.
4. **History** (`/history`) lists confirmed entries with filters; entries can be corrected or deleted.
5. **Settings** (`/settings`) holds thresholds, camera, optional voice, display comfort options, data
   export, history clearing and full deletion.
6. **Demo mode** (toggle in the top bar) seeds four fictional profiles and returns simulated,
   clearly-labelled results without touching your real records or your camera.

### Recognition safety rules enforced by the code

- Threshold + optional ambiguity margin; a close call returns `not_confident` instead of a guess.
- Raw similarity is never presented as a percentage of certainty.
- More than one face in frame → refusal, never a silent pick.
- No face, dark frame, blurry frame, corrupt upload → guidance, never an identity.
- A 12-second per-person cooldown prevents repeated alerts for the same face.
- Recognition never writes interaction history; only your confirmation does.
- Only enrolled, consenting people are ever compared; strangers are never identified.

---

## Tests

```bash
# Backend: 73 tests, no pretrained models required (uses a stub engine)
cd backend
.\.venv\Scripts\python.exe -m pytest            # macOS/Linux: .venv/bin/python -m pytest

# Frontend: 29 tests
cd frontend
npm test            # watch: npm run test:watch

# Static checks and production build
npm run typecheck
npm run build
```

### Real-pipeline verification (opt-in)

```bash
# Uses the installed models and a throwaway database; deletes it afterwards.
python scripts/verify_real_pipeline.py \
  --enrol path/to/person_a.jpg \
  --same  path/to/person_a_other.jpg \
  --other path/to/someone_else.jpg
```

It prints decisions, best scores and timings, and fails if a different person is not rejected or if
any history row was written without confirmation. Use only images you have the right to process.

---

## Deployment

This is a **local-first, single-user prototype**. The default deployment is both services on your own
machine, with the API bound to loopback.

**Local (recommended)**

```bash
cd frontend && npm run build          # static assets in frontend/dist
# serve frontend/dist with any static server, run uvicorn bound to 127.0.0.1
```

**Same machine, other people's browsers (LAN)** — read `docs/threat-model.md` first:

1. `FACERECALL_API_TOKEN=<long random value>` and `FACERECALL_ENABLE_RATE_LIMIT=true`.
2. Set `FACERECALL_FRONTEND_ORIGINS` to the exact origins you serve the frontend from.
3. Put TLS in front of the API (reverse proxy) and set `VITE_API_BASE_URL` accordingly.
4. Keep `FACERECALL_ENCRYPTION_KEY` set, and store the key outside the deployed image.
5. Remember there are **no accounts and no per-user isolation**: the token is a shared secret.

**Anything beyond that** needs real authentication, per-user row scoping, encryption at rest and in
transit, audit logging, background jobs and a security review. See the hardening checklist in
`docs/threat-model.md`.

**No Dockerfile or `docker-compose.yml` is included on purpose**: it could not be built or tested in
this environment, and shipping an unverified container configuration would be worse than shipping
none. The two commands above are the tested path.

---

## Project layout

```
facerecall/
├── backend/
│   ├── app/
│   │   ├── api/v1/          routes (people, recognition, interactions, settings, system, demo)
│   │   ├── core/            config, errors, crypto, security
│   │   ├── database/        engine, session, schema creation
│   │   ├── models/          PersonProfile, FaceEnrollment, InteractionLog, AppSettings
│   │   ├── recognition/     imaging, engine adapters (OpenCV / demo), matching, pipeline
│   │   ├── schemas/         Pydantic contracts
│   │   ├── services/        business rules (people, enrolment, interactions, settings, export, demo)
│   │   └── main.py
│   ├── tests/               73 pytest tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/{ui,app}   design system + composites
│   │   ├── pages/                landing, dashboard, recognize, people, profile, edit, history, settings, privacy, about, docs, 404
│   │   ├── layouts/              public + app shell
│   │   ├── hooks/                useAsync, useSettings, useDemoMode, useCamera, useSpeech
│   │   ├── services/             typed API clients
│   │   ├── types/                API type mirrors
│   │   ├── test/                 vitest setup, fixtures, render helper
│   │   └── App.tsx, main.tsx
│   ├── package.json
│   └── .env.example
├── docs/                     architecture, api, privacy, threat-model, testing-plan, model notes
├── scripts/                  download_models.py, init_db.py, seed_demo.py, verify_real_pipeline.py
└── README.md
```

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "FaceRecall cannot reach its local service" | The API is not running, or `VITE_API_BASE_URL` is wrong. Start uvicorn on port 8000 and check `/api/v1/health` |
| "Models not installed — demo only" | Run `python scripts/download_models.py`, then restart the API |
| `download_models.py` reports a Git LFS pointer | The plain raw URL returned a pointer. The script already prefers `media.githubusercontent.com`; if your network blocks it, clone `opencv/opencv_zoo` with `git lfs` and copy the two `.onnx` files into `backend/models/` |
| Camera permission blocked | Allow camera access for the site in your browser, then press *Start camera*. Browsers only grant cameras on `http://localhost`/`127.0.0.1` or HTTPS |
| "The camera did not respond" | The browser never answered the permission request. Check a camera is connected, then *Retry camera* |
| Always "Not confident" | Enrol another photo of that person (different angle/light), or lower the threshold in Settings. If two enrolled people look alike to the model, raise the ambiguity margin |
| Enrolment rejected | The photo must contain exactly one detectable, adequately lit and sharp face. Group photos, darkness and motion blur are rejected with a specific reason |
| `429 Too many requests` | Rate limiting is on (`FACERECALL_ENABLE_RATE_LIMIT`); wait a minute or raise the limit |
| `503 engine_unavailable` with embeddings present | Stored enrolments were made with a different model version; re-enrol them |
| Port already in use | Pick another port (`--port 8001`) and update `VITE_API_BASE_URL` |
| `pip install` fails on Python 3.14 | Use Python 3.11–3.13; numpy 2.x wheels are required for 3.13 |

---

## Privacy and security summary

- Enrolment requires explicit consent; consent cannot be changed silently, and withdrawal deletes the
  linked biometric records in the same transaction.
- No camera video and no captured frames are stored; originals are discarded after processing.
- Embeddings are biometric data, stored locally, optionally encrypted at rest, never sent to a third
  party, and never included in API responses (only in your own export).
- Any server-side key stays in `backend/.env` (`FACERECALL_*`); no platform tokens or project secrets
  belong in the repository or the frontend bundle.
- No claim of being "100% secure" or "zero knowledge" is made anywhere: see
  [docs/privacy.md](docs/privacy.md) and [docs/threat-model.md](docs/threat-model.md).

## Known limitations

- **No accuracy measurement.** Thresholds are uncalibrated defaults; the one-to-three-photo enrolment
  target is a design intention, not a validated recommendation.
- **Single-user, no accounts.** No per-user isolation, no audit log, no multi-device sync.
- **No Alembic migrations**; schema changes require a fresh database or a hand-written migration.
- **Preview images are unencrypted** even when embeddings are encrypted (they can be disabled).
- **One face per frame.** Groups require a separate conversation or a manual flow.
- **Recognition is pose/lighting sensitive** as any single-model pipeline is.
- **Not device-tested across browsers.** Camera behaviour on Safari/iOS has not been exercised.

## Roadmap

1. Calibrate thresholds on a consented volunteer dataset and publish the confusion matrix.
2. Add Alembic migrations and the PostgreSQL export/import path.
3. Add real accounts with per-user row scoping, plus an access audit log.
4. Encrypt preview images (or drop them entirely in favour of initials).
5. Ship a per-person calibration helper: "enrol more photos" suggestions driven by observed scores.
6. Accessibility and usability study with people who have prosopagnosia.

## Licence and attribution

Application code: use as you see fit for the purposes described above. Bundled/third-party components:
OpenCV (Apache-2.0), YuNet detector (MIT), SFace embedder (Apache-2.0), React, Vite, Tailwind CSS and
Lucide icons under their respective licences. Full detail in
[docs/model-and-licence-notes.md](docs/model-and-licence-notes.md).
