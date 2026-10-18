import { Card, CardBody, CardHeader } from "../components/ui/card";

export function AboutPage() {
  return (
    <div className="app-grid py-12">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Project</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">About FaceRecall</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          FaceRecall is an assistive memory tool for people with prosopagnosia (face blindness). It
          recognises only people you have deliberately enrolled with their consent, and shows the
          context you recorded about them.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        <Card>
          <CardHeader title="Problem statement" />
          <CardBody>
            <p className="text-sm leading-relaxed text-ink-soft">
              Prosopagnosia makes faces feel interchangeable. Recognising someone usually comes with
              social risk: greeting a stranger as a friend, or failing to acknowledge someone you
              know well. Generic face-recognition products are designed to identify anyone, which is
              the opposite of what is needed here. FaceRecall deliberately inverts those priorities:
              it compares only against a small, consented circle, it never attempts to identify
              strangers, and it treats "I am not sure" as a valid and frequent answer.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Intended users" />
          <CardBody>
            <ul className="list-disc space-y-2 pl-5 text-sm text-ink-soft">
              <li>People with developmental or acquired prosopagnosia.</li>
              <li>People supporting them who help maintain their circle of profiles.</li>
              <li>Researchers or accessibility engineers evaluating whether a consent-based, local-first approach is useful.</li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Proposed architecture" />
          <CardBody>
            <pre className="overflow-x-auto rounded-control bg-surface-muted p-4 text-xs leading-relaxed text-ink-soft">
{`Camera (browser MediaDevices)
  ↓ single JPEG frame, on demand
POST /api/v1/recognition/match
  ↓
Frame validation ── OpenCV decode, size/type/light/sharpness checks
  ↓
Face detection ───── YuNet (cv2.FaceDetectorYN, MIT licence)
  ↓
Alignment + embedding ─ SFace (cv2.FaceRecognizerSF, Apache-2.0)
  ↓                     → 128-D L2-normalised vector
Candidate comparison ─ cosine similarity vs enrolled embeddings
  ↓                     (real dataset only; demo dataset excluded)
Decision ───────────────threshold + optional ambiguity margin
  ↓
accepted_match → context from SQLite (name, relationship, notes…)
unknown_person / not_confident / no_face_detected → guidance, no identity
  ↓
User confirms → POST /api/v1/interactions (history entry)`}
            </pre>
            <p className="mt-3 text-sm text-muted">
              Detection, embedding, matching, and context lookup live in separate modules
              (<code>app/recognition/</code>), so the model can be replaced behind the
              <code> FaceEngine </code> protocol without touching route handlers.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Technology stack" />
          <CardBody>
            <div className="grid gap-4 text-sm text-ink-soft sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-ink">Frontend</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>React 18 + TypeScript + Vite</li>
                  <li>Tailwind CSS with a small accessible component set</li>
                  <li>React Router, Lucide icons</li>
                  <li>MediaDevices for camera, Web Speech for optional voice</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Backend</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Python 3, FastAPI, Pydantic v2</li>
                  <li>SQLAlchemy 2 with SQLite; PostgreSQL-ready URL</li>
                  <li>OpenCV 4.10 (YuNet + SFace inference)</li>
                  <li>pytest; Fernet for optional embedding encryption</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Scope and limitations" />
          <CardBody>
            <ul className="list-disc space-y-2 pl-5 text-sm text-ink-soft">
              <li>Single-user, local-first prototype. No accounts, no sync, no audit trail.</li>
              <li>Recognition only ever compares against your enrolled people.</li>
              <li>One face per frame is supported; multiple faces produce a refusal, not a choice.</li>
              <li>No alerting or background monitoring — nothing runs unless you start a session.</li>
              <li>Not a medical device, not a diagnosis, not a cure for prosopagnosia.</li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Project status" />
          <CardBody>
            <p className="text-sm leading-relaxed text-ink-soft">
              Status: working prototype. The end-to-end flow — consent, profile, enrolment,
              detection, comparison, safe decision, context display, confirmation, deletion — is
              implemented and covered by automated backend tests that pass locally (73 tests at the
              time of writing; run them yourself with <code>pytest</code>). The frontend build and
              test commands are documented in the repository README.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              <strong>Recognition accuracy has not yet been evaluated.</strong> No volunteer dataset
              has been collected, so there are no measured accuracy, false-match or latency figures.
              The evaluation plan exists in <code>docs/testing-plan.md</code>, and thresholds remain
              uncalibrated defaults until that work is done.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Disclaimer" />
          <CardBody>
            <div id="disclaimer" className="scroll-mt-24 text-sm leading-relaxed text-ink-soft">
              <p>
                FaceRecall is provided as an assistive prototype without warranty. It must not be used
                to identify strangers, to monitor people without their knowledge, to search public or
                private face databases, or as the sole basis for any consequential decision about a
                person. Facial data is sensitive: enrol only consenting people, and treat the local
                database on this machine as confidential. If you are unsure whether your use is
                lawful in your jurisdiction, seek advice before proceeding.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
