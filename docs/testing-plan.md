# Testing and evaluation plan

This document has two halves: **what is actually tested today**, and **how recognition accuracy
should be evaluated** (not yet done).

## 1. Automated tests that exist

### Backend — `cd backend && .\.venv\Scripts\python.exe -m pytest`

73 tests, all passing on Windows with Python 3.13, numpy 2.1.3 and OpenCV 4.10. They use a stub
engine, so **no pretrained model is required** and there is no network access.

| File | Coverage |
| --- | --- |
| `tests/test_matching.py` | Cosine similarity (identity, orthogonality, dimension mismatch, zero vector), threshold rejection → `unknown_person`, acceptance, ambiguity-margin rejection → `not_confident`, margin disabled, single-candidate behaviour, deterministic tie-break, per-person best across multiple enrolments, invalid margin |
| `tests/test_people_api.py` | Consent required, blank name rejected, create/read/list/search/filter/sort, update, consent immutability via PATCH, delete cascading to interactions, structured 404, oversized field values |
| `tests/test_recognition_api.py` | Enrolment stores 128-D metadata; consent gate blocks enrolment; withdrawal deletes biometrics; no-face and multi-face rejection; 3-photo limit; duplicate-photo rejection; accepted match returns context; no history written automatically; unknown person; nothing enrolled; not-confident between two close profiles; no face in frame; multiple faces; corrupt image; blurry image; unsupported content type; engine unavailable → 503; enrolment removal |
| `tests/test_interactions.py` | Create/list/update/delete, person requirement, filters (person, date range), last-confirmed propagation, demo profiles reject writes, demo separation from the real directory, demo recognition labelled simulated, demo-not-seeded error |
| `tests/test_settings.py` | Defaults, updates, invalid ranges rejected, threshold actually drives the decision, diagnostics payload |
| `tests/test_data_controls.py` | Health/status, dashboard counts derived from rows, export contents + warning, `DELETE ALL` confirmation required, full deletion resets settings, OpenAPI document available |
| `tests/test_security.py` | Fernet round-trip, plaintext when no key, invalid key error, thumbnail path traversal rejected, thumbnail round-trip, upload size limit → 413, no embedding material in API output, deletion removes thumbnail files |

### Frontend — `cd frontend && npm test`

29 tests across 7 files (Vitest + Testing Library, jsdom), all passing.

| File | Coverage |
| --- | --- |
| `src/App.test.tsx` | Landing route, dashboard route with main navigation, people route, unknown route → not-found |
| `src/pages/__tests__/Landing.test.tsx` | Hero headline, both CTAs, three-step flow, honest limitation wording |
| `src/pages/__tests__/People.test.tsx` | Listing from the API, empty state, demo labelling + read-only cards, error state with retry, search propagation to the API |
| `src/pages/__tests__/Recognize.test.tsx` | Camera starts only on explicit action, permission-denied guidance, accepted match with context and no percentage, not-confident state without a confirm button, interaction recorded only after confirmation, demo mode labelled simulated and camera-free |
| `src/pages/__tests__/PersonNew.test.tsx` | Name required, consent blocks saving, successful creation payload, photo target/limits wording |
| `src/pages/__tests__/PersonProfile.test.tsx` | Context rendering, "Not recorded" instead of an invented date, delete confirmation, separate consent-withdrawal confirmation, enrolment metadata |
| `src/hooks/__tests__/useCamera.test.tsx` | Permission denial mapping with guidance, 20 s no-answer timeout, ready state + device listing + track cleanup on stop |

### Build and static checks

- `cd frontend && npm run build` → `tsc --noEmit && vite build` completes (bundle ≈ 330 kB JS / 25 kB CSS).
- `cd frontend && npm run typecheck` → clean.

### Manual verification performed

- **Real models**: `python scripts/download_models.py` fetched YuNet (232,589 bytes, MIT) and SFace
  (38,696,353 bytes, Apache-2.0) from the OpenCV Model Zoo LFS media endpoint; both loaded in
  OpenCV 4.10 and produced a detection plus a normalised 128-D embedding.
- **Engine smoke test** on a single public sample image: detection confidence 0.909; self-match
  cosine 1.000; brightness-adjusted copy 0.868; 60 % scaled copy 0.933; unrelated random embedding
  −0.073.
- **API integration with the real engine** (`scripts/verify_real_pipeline.py`, throwaway database):
  engine mode `real`, enrolment 201, same image → `accepted_match` (best 1.0, 22 ms), different
  person → `unknown_person` (best 0.130), zero history entries written without confirmation,
  profile deletion cleaned up its enrolment.
- **Browser flow** against the running dev server: created a profile through the enrolment form
  (consent enforced), rendered the profile and directory from live API data, deleted it through the
  confirmation dialog, and confirmed the toast and cascade. The interface reported
  "Real recognition ready" from `/api/v1/status`.

## 2. What is *not* measured

**Recognition accuracy is not yet evaluated.** There is no volunteer dataset, so there are no
accuracy, false-match, false-rejection, or latency distributions to report. The numbers above are
single-site smoke observations on one image pair, not an evaluation. The default threshold (0.45)
and margin (0.05) are **uncalibrated starting points**.

## 3. Evaluation protocol to follow

1. **Recruit with consent.** Written, informed consent for storing and processing face data for this
   evaluation, with a stated retention period and a deletion route. Target ≥ 10 people for any
   threshold claim; report the actual number.
2. **Split images by person and session.** Enrolment photos and test photos must come from different
   sessions. Never evaluate on the images used for enrolment.
3. **Design the conditions.** For each person capture: frontal/even light, angled (≈30°), dim light,
   strong backlight, glasses, with/without facial hair, different expressions, and at least one
   lower-quality image.
4. **Vary enrolment size.** Run the whole protocol with 1, then 2, then 3 enrolment photos. Report
   each separately; do not average them.
5. **Include non-enrolled people.** At least as many test subjects who are *not* enrolled, to measure
   false matches and correct rejections of unknown people.
6. **Record, per trial**: decision, matched person id (if any), best score, second-best score, margin,
   processing time, face count, and frame quality.
7. **Compute**: true accept rate, false accept rate, unknown-rejection rate, not-confident rate,
   missed-detection rate, and latency percentiles (p50/p95) per condition and per enrolment count.
8. **Sweep the threshold** across 0.25–0.75 in 0.05 steps and plot false accepts against true accepts
   to pick a defensible operating point. Repeat with and without the ambiguity margin.
9. **Report honestly**: dataset size, conditions, hardware, model and preprocessing versions, and
   every failure. Publish the confusion matrix, not just the headline number.
10. **Re-run after any model, preprocessing or threshold change**, and store the results next to the
    model version in `docs/`.

## 4. Known gaps to close before claiming usefulness

- No quantitative accuracy data (blocking any accuracy claim).
- No usability testing with people who have prosopagnosia — the value of the context card, the
  wording of the refusal states, and the alert cooldown are all untested with real users.
- No latency measurements on lower-end hardware, phones, or battery impact.
- No accessibility audit with assistive-technology users beyond the automated checks and manual
  keyboard review.
- No security review, dependency scanning, or pen test.
