# Privacy, retention and data controls

FaceRecall processes biometric data, which is sensitive. This document describes exactly what the
prototype stores, where, for how long, and how it is removed. It is an engineering description, not
legal advice, and no compliance claim is made.

## What is stored

| Data | Where | Notes |
| --- | --- | --- |
| Profile context (name, relationship, where met, group, notes, reminder) | SQLite `person_profiles` | Free text you typed; nothing is inferred |
| Face embedding (128 float32, 512 bytes) | SQLite `face_enrollments.embedding_blob` | Biometric data; optional Fernet encryption |
| Preview image (max 320 px JPEG) | `backend/data/thumbnails/<uuid>.jpg` | Controlled by the `retain_thumbnails` preference |
| Consent flag + timestamp | SQLite `person_profiles` | Set at creation, updated on withdrawal |
| Interaction history | SQLite `interaction_logs` | Only entries you confirmed |
| Settings | SQLite `app_settings` | Thresholds, voice, display, retention |

## What is not stored

- **No camera video and no captured frames.** A frame lives in memory for the duration of one
  request and is discarded. There is no recording feature, no ring buffer and no frame archive.
- **No original enrolment photos.** The upload is decoded in memory, reduced to an embedding and a
  small preview, and then dropped. The thumbnail is deliberately much smaller than the source.
- **No third-party transmission.** No cloud face API, no analytics, no telemetry. The only network
  calls are browser → local API.
- **No biometric values in logs, URLs, or API responses.** Log lines contain method, path, status,
  duration and decision counts. Embeddings are excluded from every response schema; the data export
  is the single deliberate exception.

## Protection in place

- Optional encryption at rest: set `FACERECALL_ENCRYPTION_KEY` (Fernet) and embeddings are stored
  as `enc:v1:<token>`. `/api/v1/status` reports `encryption_enabled` truthfully; when no key is
  configured, embeddings are stored unencrypted and both the API and the Settings screen say so.
- Restricted CORS (`FACERECALL_FRONTEND_ORIGINS`), bounded uploads (size, type, pixel count), and
  server-generated filenames with a strict pattern (`^[a-f0-9]{32}\.jpg$`) that prevents path
  traversal.
- Optional shared bearer token (`FACERECALL_API_TOKEN`) and optional rate limiting for recognition.
- Security headers on API responses (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Cache-Control: no-store`).

## What is *not* claimed

- Embeddings are **not anonymous**. A vector derived from a face is pseudonymous at best and can be
  re-identified in some circumstances; treat it as biometric data.
- The system is **not "100% secure"** and is **not "zero knowledge"**. There is no end-to-end
  encryption, no key management service, no audit log and no independent security review.
- This prototype has **no user accounts**. Anyone with access to the machine and the browser can
  read the data. A multi-user deployment would need authentication, per-user scoping of every query,
  encryption at rest and in transit, and an access log.

## Retention policy

| Situation | Effect |
| --- | --- |
| Recognising a face | Nothing is written |
| Confirming an interaction | One `interaction_logs` row |
| Dismissing a match | Nothing is written; the match is not stored |
| Withdrawing consent | Linked embeddings deleted and thumbnail files removed immediately; profile and history remain |
| Deleting a profile | Embeddings, thumbnails and interaction history deleted (cascade) |
| "Clear interaction history" | All interaction rows deleted; profiles untouched |
| "Delete all profiles and biometric data" | All real profiles, embeddings, thumbnails, interactions deleted and settings reset. Requires typing `DELETE ALL` |
| Uninstalling | Delete `backend/data/` and `backend/models/`; that is the whole footprint |

Demo profiles are flagged `is_demo` and are excluded from real matching, the real directory, and the
default data-deletion scope (an explicit checkbox includes them).

## Consent requirements

Enrolment requires an explicit consent confirmation. The API rejects profile creation and enrolment
without it, and consent cannot be changed through a profile update — withdrawal has its own endpoint
that deletes the biometric records in the same transaction. This is why every enrolment photo should
come from a person who has agreed, understands what FaceRecall is for, and knows how to have their
data removed.

## Data subject controls

1. `GET /api/v1/export` — complete JSON export (profiles, context, interactions, settings, and
   embeddings in base64). The response includes a warning that the file contains biometric data.
2. `POST /api/v1/people/{id}/consent/withdraw` — stop processing and delete face data for one person.
3. `DELETE /api/v1/people/{id}` — remove a person's profile and all linked records.
4. `DELETE /api/v1/interactions` — clear history without touching profiles.
5. `DELETE /api/v1/data` — erase everything, with a typed confirmation phrase.

The same actions are available in the interface (Person profile → Privacy controls, and
Settings → Privacy).

## Legal and ethical notes

Biometric processing is regulated in many jurisdictions (for example the GDPR's special-category
rules, or Illinois BIPA and similar statutes), and obligations differ by country and by use case:
lawful basis and consent, purpose limitation, data minimisation, storage limitation, security,
breach notification, and rights of access, correction and erasure. FaceRecall's design supports
these principles (consent gate, minimisation, local processing, export and deletion), but **you are
responsible for the lawfulness of your own use**, and this document is not legal advice.

Hard rules the application enforces and you should keep:

- Do not identify strangers, and do not use FaceRecall for surveillance or crowd monitoring.
- Do not scrape social media or any public source for enrolment photos.
- Do not use a match as the sole basis for a consequential decision about someone.
- Tell enrolled people what the app does and how to withdraw.
