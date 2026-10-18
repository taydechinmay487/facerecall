import { Card, CardBody, CardHeader } from "../components/ui/card";

const setupCommands = `# 1. Backend
cd backend
py -3.13 -m venv .venv                 # Windows (macOS/Linux: python3 -m venv .venv)
.\\.venv\\Scripts\\activate              # source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                 # cp on macOS/Linux

# 2. Optional but recommended: real models
python ../scripts/download_models.py
python ../scripts/init_db.py

# 3. Run the API
uvicorn app.main:app --reload --port 8000

# 4. Frontend (new terminal)
cd frontend
npm install
copy .env.example .env
npm run dev                            # http://localhost:5173`;

const testCommands = `# Backend (73 tests, no pretrained models required)
cd backend && .\\.venv\\Scripts\\python.exe -m pytest

# Frontend unit and component tests
cd frontend && npm test

# Type checking and production build
cd frontend && npm run build`;

export function DocsPage() {
  return (
    <div className="app-grid py-12">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
          Documentation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Setup, API and operations</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          The repository README carries the full, authoritative setup instructions. This page
          summarises the parts you need while running the app.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        <Card>
          <CardHeader title="Install and run both services" />
          <CardBody>
            <pre className="overflow-x-auto rounded-control bg-surface-muted p-4 text-xs leading-relaxed text-ink-soft">
              {setupCommands}
            </pre>
            <p className="mt-3 text-sm text-muted">
              The frontend expects the API at <code>http://127.0.0.1:8000</code> by default; override
              it with <code>VITE_API_BASE_URL</code>.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Face models and licences" />
          <CardBody>
            <div className="space-y-3 text-sm text-ink-soft">
              <p>
                Real recognition requires two ONNX files in <code>backend/models/</code>, downloaded
                by <code>scripts/download_models.py</code> from the OpenCV Model Zoo:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code>face_detection_yunet_2023mar.onnx</code> — YuNet detector, MIT licence.
                </li>
                <li>
                  <code>face_recognition_sface_2021dec.onnx</code> — SFace embedder, Apache-2.0.
                </li>
              </ul>
              <p>
                Both are run through OpenCV&apos;s own inference wrappers
                (<code>cv2.FaceDetectorYN</code>, <code>cv2.FaceRecognizerSF</code>), so no extra
                runtime is needed. SFace produces a 128-dimension vector compared with cosine
                similarity. If the download returns a Git LFS pointer, the script explains how to
                fetch the real file with <code>git lfs</code>.
              </p>
              <p>
                Without the models the API still starts: real recognition returns HTTP 503
                <code> engine_unavailable </code>, and demo mode stays available and clearly labelled.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="API reference" />
          <CardBody>
            <div id="api" className="scroll-mt-24 space-y-3 text-sm text-ink-soft">
              <p>
                Interactive OpenAPI documentation is served by the backend at{" "}
                <a
                  href="http://127.0.0.1:8000/api/v1/docs"
                  className="font-semibold text-accent-strong underline-offset-4 hover:underline"
                >
                  http://127.0.0.1:8000/api/v1/docs
                </a>{" "}
                (and the schema at <code>/api/v1/openapi.json</code>).
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code>GET /api/v1/health</code>, <code>GET /api/v1/status</code> — readiness, engine
                  state (no biometric content).
                </li>
                <li>
                  <code>GET|POST /api/v1/people</code>, <code>GET|PATCH|DELETE /api/v1/people/{"{id}"}</code>{" "}
                  — profiles; consent is required to create one and cannot be edited silently.
                </li>
                <li>
                  <code>POST /api/v1/people/{"{id}"}/enroll</code>,{" "}
                  <code>DELETE /api/v1/people/{"{id}"}/enrollments/{"{eid}"}</code> — enrolment photos
                  (max 3).
                </li>
                <li>
                  <code>POST /api/v1/recognition/match</code> — one frame; returns a structured
                  decision. <code>POST /api/v1/recognition/demo</code> returns a simulated result.
                </li>
                <li>
                  <code>GET|POST /api/v1/interactions</code>,{" "}
                  <code>PATCH|DELETE /api/v1/interactions/{"{id}"}</code>,{" "}
                  <code>DELETE /api/v1/interactions</code> — confirmed history only.
                </li>
                <li>
                  <code>GET|PATCH /api/v1/settings</code>, <code>GET /api/v1/settings/diagnostics</code>.
                </li>
                <li>
                  <code>GET /api/v1/export</code>, <code>DELETE /api/v1/data</code> (requires{" "}
                  <code>{'{"confirm_text": "DELETE ALL"}'}</code>).
                </li>
              </ul>
              <p>
                Errors always use one envelope:{" "}
                <code>{'{"error": {"code": "…", "message": "…", "details": {…}}}'}</code>.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tests" />
          <CardBody>
            <pre className="overflow-x-auto rounded-control bg-surface-muted p-4 text-xs leading-relaxed text-ink-soft">
              {testCommands}
            </pre>
            <p className="mt-3 text-sm text-muted">
              Backend tests use a stub engine, so they run without the pretrained models. They cover
              consent enforcement, threshold and margin behaviour, unknown/not-confident outcomes,
              no-face and multi-face handling, interaction rules, settings validation, exports,
              deletion and path-safety.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Troubleshooting" />
          <CardBody>
            <dl className="space-y-4 text-sm text-ink-soft">
              <div>
                <dt className="font-semibold text-ink">Camera permission is blocked</dt>
                <dd>
                  Allow camera access in the browser&apos;s site settings, then press Start camera
                  again. Browsers only grant cameras on <code>http://localhost</code> or HTTPS.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">"Models not installed — demo only"</dt>
                <dd>
                  Run <code>python scripts/download_models.py</code> from the repository root and
                  restart the backend. The status badge in the top bar updates when the API reports
                  the models present.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Recognition always says "not confident"</dt>
                <dd>
                  Enrol another photo of that person with a different angle, or lower the acceptance
                  threshold in Settings. If two enrolled people look alike to the model, increase the
                  ambiguity margin so it refuses rather than guesses.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">"FaceRecall cannot reach its local service"</dt>
                <dd>
                  The backend is not running, or <code>VITE_API_BASE_URL</code> points somewhere else.
                  Start uvicorn on port 8000 and check <code>/api/v1/health</code>.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Enrolment photo rejected</dt>
                <dd>
                  FaceRecall requires exactly one detectable, adequately lit and sharp face per photo.
                  Dark, blurry, or group photos are rejected with a specific message rather than
                  stored.
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Known limitations" />
          <CardBody>
            <div id="limitations" className="scroll-mt-24">
              <ul className="list-disc space-y-2 pl-5 text-sm text-ink-soft">
                <li>Recognition accuracy has not been measured; thresholds are uncalibrated defaults.</li>
                <li>One-to-three enrolment photos is a design target, not a validated recommendation.</li>
                <li>Single-user local prototype: no accounts, roles or multi-device sync.</li>
                <li>Embeddings are stored unencrypted unless you configure an encryption key.</li>
                <li>Recognition is pose- and lighting-sensitive, as any single-model pipeline is.</li>
                <li>Demo mode results are simulated and must never be read as model output.</li>
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
