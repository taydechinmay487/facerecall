# Threat model

Scope: the local, single-user FaceRecall prototype as shipped (browser + local FastAPI service +
SQLite file). It is written to be honest about what is and is not defended.

## Assets

1. **Face embeddings** — biometric templates; pseudonymous, re-identification risk.
2. **Preview images** — small face photos.
3. **Profile context** — names, relationships, notes; sensitive personal data about third parties.
4. **Interaction history** — where and when you met people.
5. **Consent records** — evidence of agreement; integrity matters.
6. **Configuration and keys** — `FACERECALL_ENCRYPTION_KEY`, optional `FACERECALL_API_TOKEN`.

## Trust boundaries

```
[Camera + browser] --HTTP(loopback)--> [FastAPI process] --> [SQLite file + thumbnails on disk]
```

- The browser is trusted to display results but never to assert identity: every decision is made
  server-side, and the client cannot supply a similarity score or a person id for a match.
- The local filesystem is trusted. Anyone who can read `backend/data/` can read the database
  (unless encryption is configured) and the preview images.
- The network is *not* trusted: the API is intended for loopback. Exposing it elsewhere requires the
  token and TLS in front of it, and changes the risk profile substantially.

## Threats and mitigations

| # | Threat | Mitigation in this codebase | Residual risk |
| --- | --- | --- | --- |
| T1 | Unauthorised local reader opens the database file | Optional Fernet encryption of embeddings; no sensitive data in logs or URLs | Preview images and profile context are **not** encrypted; disk-level protection is the operator's job |
| T2 | Third party reaches the API over the network | Bind to loopback by default; CORS allowlist; optional bearer token; optional rate limiting | Without the token and TLS, anyone who can reach the port has full access. There is no multi-user isolation |
| T3 | Malicious upload (zip bomb, huge image, polyglot, path traversal) | Size limit before buffering, content-type + extension allowlist, pixel-count limit, OpenCV decode, server-generated filenames matched against a strict regex, no user paths accepted | Decoder-level vulnerabilities in OpenCV/Pillow-class libraries are inherited from the dependency; keep them patched |
| T4 | Injection through profile text | SQLAlchemy parameterised queries everywhere; React escapes rendered text; no raw SQL string building | Notes are rendered as text, never as HTML |
| T5 | False match leading to a wrong real-world identification | Threshold + ambiguity margin, refusal states (`unknown_person`, `not_confident`), no percentage certainty, confirmation required before recording | The threshold is uncalibrated by default; a confident-but-wrong match remains possible and is the core model risk |
| T6 | Enrolling someone without consent | `consent_confirmed` must be true; API rejects otherwise; consent cannot be patched; withdrawal deletes biometrics | The application cannot verify that consent was genuinely given out of band |
| T7 | Silent surveillance / stranger identification | Recognition only ever compares against the enrolled set; no external database calls; no background loop (nothing runs until the user starts a session); demo data is separated and labelled | Nothing technically prevents a determined operator from enrolling people improperly |
| T8 | Biometric data leaking through logs or URLs | No embeddings in responses; logs carry method/path/status/duration and decision counts only; avatar served by id under `/api/v1/people/{id}/avatar` | Anyone with DB access sees embeddings unless encryption is on |
| T9 | Data surviving deletion | Explicit delete endpoints, cascade deletes, thumbnail file removal, `DELETE /api/v1/data` with typed confirmation | Filesystem snapshots/backups made outside the app are outside its control |
| T10 | Consent state quietly overwritten | `PATCH /people/{id}` rejects `consent_status`; the only mutation path is the withdraw endpoint, which records a new timestamp | None identified |
| T11 | Denial of service on the recognition endpoint | Bounded uploads, one frame per request, configurable interval, optional rate limiting, engine work in-process | A local attacker can still exhaust CPU/GPU; recognition is CPU-heavy by design |
| T12 | Model/version mismatch producing meaningless similarity | Enrolment rows store `model_name`, `model_version`, `preprocessing_version`; incompatible rows are skipped during matching and counted in a warning log | Skipped rows mean fewer candidates, which errs toward rejection (safe direction) |
| T13 | Supply-chain compromise of dependencies | Versions pinned in `requirements.txt` and `package.json`; no post-install scripts from untrusted sources | No lockfile hashing for Python, no SBOM, no signature verification yet |
| T14 | Demo output mistaken for a real result | `mode: "demo"`, `is_simulated: true`, distinct model id `demo-synthetic`, persistent banner, separate dataset | None identified; the labelling is explicit end to end |

## Out of scope

- Multi-user hosting, tenancy isolation, SSO, and audit logging.
- Mobile native clients, offline sync, and remote device pairing.
- Regulatory certification, pen-testing, and formal privacy impact assessments.
- Protecting data from an administrator or malware with the same OS privileges as the app.

## Hardening checklist for anything beyond personal local use

1. Put TLS in front of the API and never expose the raw port.
2. Set `FACERECALL_API_TOKEN` (long random value) and `FACERECALL_ENABLE_RATE_LIMIT=true`.
3. Set `FACERECALL_ENCRYPTION_KEY` and store the key outside the machine/image.
4. Move to PostgreSQL, add real accounts, and scope **every** query by user id.
5. Encrypt preview images or disable them (`retain_thumbnails=false`).
6. Add structured audit logging (who accessed which profile, when) without biometric content.
7. Configure disk encryption and backups that respect the deletion guarantees.
8. Commission an independent security review and a data-protection review before real-world use.
