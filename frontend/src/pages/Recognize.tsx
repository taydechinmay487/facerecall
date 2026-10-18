import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  FlaskConical,
  Info,
  Pause,
  Play,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { PersonAvatar } from "../components/app/PersonAvatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody, CardHeader } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { TextareaField } from "../components/ui/field";
import { useToast } from "../components/ui/toast";
import { useCamera } from "../hooks/useCamera";
import { useDemoMode } from "../hooks/useDemoMode";
import { useSettings } from "../hooks/useSettings";
import { useSpeech } from "../hooks/useSpeech";
import { formatDate, formatDateTime, formatRelative, toDateTimeInputValue } from "../lib/format";
import { interactionService } from "../services/interactions";
import { recognitionService } from "../services/recognition";
import type { Decision, RecognitionResult } from "../types/api";

const COOLDOWN_MS = 12_000;

const decisionCopy: Record<
  Decision,
  { title: string; tone: "neutral" | "caution" | "danger" | "accent" }
> = {
  accepted_match: { title: "Match accepted", tone: "accent" },
  unknown_person: { title: "Unknown person", tone: "neutral" },
  not_confident: { title: "Not confident enough to identify", tone: "caution" },
  no_face_detected: { title: "No face detected", tone: "caution" },
  multiple_faces_detected: { title: "More than one face in view", tone: "caution" },
  processing_error: { title: "That frame could not be processed", tone: "danger" },
};

export function RecognizePage() {
  const { settings, update } = useSettings();
  const demo = useDemoMode();
  const toast = useToast();
  const { videoRef, status: cameraStatus, issue, devices, deviceId, start, stop, captureFrame } =
    useCamera();
  const speech = useSpeech();

  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Camera is off. Nothing is being captured.");
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [outcome, setOutcome] = useState<RecognitionResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>(() =>
    toDateTimeInputValue(new Date().toISOString()),
  );
  const [saving, setSaving] = useState(false);
  const [logged, setLogged] = useState(false);
  const [rejectedName, setRejectedName] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const cooldowns = useRef<Map<number, number>>(new Map());
  const inflight = useRef<AbortController | null>(null);

  const handleResult = useCallback(
    (next: RecognitionResult) => {
      setOutcome(next);
      setApiError(null);
      setLastChecked(new Date().toISOString());

      if (next.decision === "accepted_match" && next.person) {
        const now = Date.now();
        const last = cooldowns.current.get(next.person.id) ?? 0;
        if (now - last < COOLDOWN_MS) {
          setStatusMessage(`Holding the previous match for ${next.person.name}.`);
          return;
        }
        cooldowns.current.set(next.person.id, now);
        setResult(next);
        setLogged(false);
        setStatusMessage("Match accepted. Please confirm whether this is correct.");
        if (settings?.voice_enabled) {
          const parts = [next.person.name, next.person.relationship, next.person.where_met].filter(
            Boolean,
          ) as string[];
          speech.speak(parts.join(". "), {
            rate: settings.speech_rate,
            voiceName: settings.speech_voice,
          });
        }
        return;
      }

      setStatusMessage(next.explanation);
    },
    [settings, speech],
  );

  const processFrame = useCallback(async () => {
    if (inflight.current) return;
    const frame = await captureFrame();
    if (!frame) {
      setStatusMessage("Waiting for the camera to warm up…");
      return;
    }
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const next = await recognitionService.match(frame, controller.signal);
      if (controller.signal.aborted) return;
      handleResult(next);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setApiError((error as Error).message);
      setPaused(true);
    } finally {
      if (inflight.current === controller) inflight.current = null;
    }
  }, [captureFrame, handleResult]);

  useEffect(() => {
    if (!started || paused || demo.enabled || !settings) return;
    let cancelled = false;
    let timer = 0;
    const interval = Math.max(300, settings.frame_interval_ms);

    const tick = async () => {
      if (cancelled) return;
      await processFrame();
      if (!cancelled) timer = window.setTimeout(tick, interval);
    };

    timer = window.setTimeout(tick, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      inflight.current?.abort();
    };
  }, [started, paused, demo.enabled, processFrame, settings]);

  const stopCamera = () => {
    inflight.current?.abort();
    stop();
    setStarted(false);
    setPaused(false);
    setStatusMessage("Camera stopped. Nothing was recorded.");
  };

  useEffect(() => {
    if (!demo.enabled) return;
    inflight.current?.abort();
    stop();
    setStarted(false);
    setPaused(false);
    setStatusMessage("Demo mode does not use the camera.");
  }, [demo.enabled, stop]);

  const startCamera = async () => {
    setApiError(null);
    setResult(null);
    setOutcome(null);
    setRejectedName(null);
    setPaused(false);
    const ok = await start(deviceId || undefined);
    setStarted(ok);
    if (ok) setStatusMessage("Camera ready. Looking for a single face…");
  };

  const runDemoMatch = async () => {
    setBusy(true);
    setApiError(null);
    try {
      const next = await recognitionService.demoMatch();
      handleResult(next);
    } catch (error) {
      setApiError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmMatch = async () => {
    if (!result?.person) return;
    setSaving(true);
    try {
      await interactionService.create({
        person_profile_id: result.person.id,
        occurred_at: new Date(occurredAt).toISOString(),
        event_source: "recognition_assisted",
        confirmation_status: "confirmed",
        user_note: note.trim() || null,
      });
      setLogged(true);
      setConfirmOpen(false);
      setNote("");
      toast.push(`Interaction with ${result.person.name} recorded.`, "success");
    } catch (error) {
      toast.push((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const rejectMatch = () => {
    setRejectedName(result?.person?.name ?? null);
    setResult(null);
    setStatusMessage("Dismissed. No interaction was recorded.");
    cooldowns.current.clear();
  };

  const voiceEnabled = Boolean(settings?.voice_enabled);

  return (
    <div>
      <PageHeader
        eyebrow="Live recognition"
        title="Recognize a familiar face"
        description="Frames are analysed one at a time in your local service. Nothing is saved unless you confirm an interaction."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void update({ voice_enabled: !voiceEnabled })}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            )}
            Voice {voiceEnabled ? "on" : "off"}
          </Button>
        }
      />

      {demo.enabled ? (
        <Card className="mb-5 border-caution/40 bg-caution-soft">
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <FlaskConical className="mt-0.5 h-5 w-5 text-caution" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-caution">Demo mode: simulated results</h2>
                  <p className="text-sm text-ink-soft">
                    The camera is not used here. A fictional demo profile is returned and labelled as
                    simulated so you can explore the interface safely.
                  </p>
                </div>
              </div>
              <Button onClick={() => void runDemoMatch()} loading={busy} variant="secondary">
                <ScanFace className="h-4 w-4" aria-hidden="true" />
                Show a simulated match
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {apiError ? (
        <Card className="mb-5 border-danger/40 bg-danger-soft">
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-danger">Recognition paused</h2>
                <p className="text-sm text-ink-soft">{apiError}</p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={startCamera}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section aria-labelledby="camera-heading">
          <Card>
            <CardHeader
              id="camera-heading"
              title="Camera"
              description="Only one face in view is supported in this version."
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={cameraStatus === "ready" ? "success" : "neutral"}>
                    {cameraStatus === "ready" ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-accent-strong" aria-hidden="true" />
                        Camera on
                      </>
                    ) : cameraStatus === "requesting" ? (
                      "Requesting permission"
                    ) : cameraStatus === "error" ? (
                      "Camera unavailable"
                    ) : (
                      "Camera off"
                    )}
                  </Badge>
                  {demo.enabled ? <Badge tone="caution">Demo</Badge> : null}
                </div>
              }
            />
            <CardBody>
              <div className="relative overflow-hidden rounded-card border border-line bg-ink">
                <video
                  ref={videoRef}
                  className="aspect-video w-full bg-ink object-cover"
                  muted
                  playsInline
                  aria-label="Live camera preview (not recorded)"
                />
                {!started ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/85 px-6 text-center">
                    <Camera className="h-8 w-8 text-white/80" aria-hidden="true" />
                    <p className="max-w-sm text-sm text-white/90">
                      The camera stays off until you press start. Ask for consent before pointing it
                      at anyone.
                    </p>
                    {!demo.enabled ? (
                      <Button onClick={() => void startCamera()} loading={cameraStatus === "requesting"}>
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        Start camera
                      </Button>
                    ) : (
                      <p className="text-xs text-white/70">
                        Demo mode does not request camera access.
                      </p>
                    )}
                  </div>
                ) : null}
                {started && paused ? (
                  <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-4 py-2 text-center text-sm font-medium text-white">
                    Paused — the camera is still on
                  </div>
                ) : null}
              </div>

              <p aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm font-medium text-ink-soft">
                {statusMessage}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {started ? (
                  <>
                    <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
                      {paused ? (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Pause className="h-4 w-4" aria-hidden="true" />
                      )}
                      {paused ? "Resume" : "Pause"}
                    </Button>
                    <Button variant="primary" onClick={() => void processFrame()} loading={false}>
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Check now
                    </Button>
                    <Button variant="dangerOutline" onClick={stopCamera}>
                      <CameraOff className="h-4 w-4" aria-hidden="true" />
                      Stop camera
                    </Button>
                  </>
                ) : null}
              </div>

              {devices.length > 1 && started ? (
                <div className="mt-4">
                  <label htmlFor="camera-device" className="block text-sm font-semibold text-ink">
                    Camera device
                  </label>
                  <select
                    id="camera-device"
                    className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-base"
                    value={deviceId}
                    onChange={(event) => void start(event.target.value)}
                  >
                    {devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || "Camera"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {issue ? (
                <div className="mt-4 rounded-card border border-caution/40 bg-caution-soft p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-caution" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-caution">{issue.message}</p>
                      <p className="mt-1 text-sm text-ink-soft">{issue.help}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => void startCamera()}
                      >
                        Retry camera
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex items-start gap-2 rounded-control bg-surface-muted px-3 py-2 text-xs text-muted">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p>
                  Frames are sent to your local FaceRecall service for analysis and then discarded.
                  No video, no recording, no continuous storage.
                </p>
              </div>
            </CardBody>
          </Card>
        </section>

        <section aria-labelledby="result-heading" className="space-y-4">
          {result?.person ? (
            <Card>
              <CardHeader
                id="result-heading"
                title="Possible match"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {result.is_simulated ? "Simulated demo match" : "Match accepted"}
                    </Badge>
                  </div>
                }
              />
              <CardBody>
                <div className="flex items-start gap-3">
                  <PersonAvatar
                    name={result.person.name}
                    avatarUrl={result.person.avatar_url}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-ink">{result.person.name}</h3>
                    <p className="text-sm text-ink-soft">
                      {result.person.relationship ?? "Relationship not recorded"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {result.person.enrollment_count} enrolment photo
                      {result.person.enrollment_count === 1 ? "" : "s"} ·{" "}
                      {result.is_simulated
                        ? "simulated result"
                        : `analysed in ${Math.round(result.processing_ms)} ms`}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
                  {[
                    ["Where you met", result.person.where_met],
                    ["Group or workplace", result.person.organization_or_group],
                    ["Notes and cues", result.person.notes],
                    ["Reminder", result.person.reminder],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {label}
                      </dt>
                      <dd className="text-ink">{value || <span className="text-muted">Not recorded</span>}</dd>
                    </div>
                  ))}
                  <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Last confirmed
                    </dt>
                    <dd className="text-ink">
                      {result.person.last_confirmed_interaction_at
                        ? `${formatDate(result.person.last_confirmed_interaction_at)} (${formatRelative(
                            result.person.last_confirmed_interaction_at,
                          )})`
                        : "Not recorded"}
                    </dd>
                  </div>
                </dl>

                <p className="mt-4 rounded-control bg-accent-soft px-3 py-2 text-sm text-accent-strong">
                  A match is a suggestion, not a fact. Please confirm it yourself before relying on
                  it.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setConfirmOpen(true)} disabled={logged}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {logged ? "Interaction recorded" : "Correct match"}
                  </Button>
                  <Button variant="secondary" onClick={rejectMatch}>
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Not this person
                  </Button>
                  <Link
                    to={`/people/${result.person.id}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
                  >
                    View profile
                  </Link>
                  <Button variant="ghost" onClick={() => setResult(null)}>
                    Dismiss
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="mt-3 rounded text-sm font-medium text-ink-soft underline underline-offset-4 hover:text-ink"
                >
                  Something is wrong with this match — report it
                </button>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader id="result-heading" title="Result" description="Nothing is recorded until you confirm it." />
              <CardBody>
                {outcome && outcome.decision !== "accepted_match" ? (
                  <div className="rounded-card border border-line bg-surface-muted p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-ink">
                        {decisionCopy[outcome.decision].title}
                      </h3>
                      <Badge tone={decisionCopy[outcome.decision].tone}>
                        {outcome.decision === "unknown_person"
                          ? "No match"
                          : outcome.decision === "not_confident"
                            ? "Needs a clearer view"
                            : "Try again"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-soft">{outcome.explanation}</p>
                    {outcome.guidance ? (
                      <p className="mt-2 text-sm text-muted">{outcome.guidance}</p>
                    ) : null}
                  </div>
                ) : null}

                {rejectedName ? (
                  <div className="mt-3 rounded-card border border-caution/40 bg-caution-soft p-4">
                    <p className="text-sm font-semibold text-caution">
                      You marked that match as wrong ({rejectedName})
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      No interaction was recorded. Improving the enrolment photos or adjusting the
                      threshold usually helps.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to="/settings"
                        className="inline-flex min-h-[38px] items-center rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink"
                      >
                        Adjust threshold
                      </Link>
                      <button
                        type="button"
                        onClick={() => setReportOpen(true)}
                        className="inline-flex min-h-[38px] items-center rounded-control px-3 py-1.5 text-sm font-semibold text-accent-strong underline-offset-4 hover:underline"
                      >
                        Report a wrong match
                      </button>
                    </div>
                  </div>
                ) : null}

                {!outcome && !rejectedName ? (
                  <div className="py-6 text-center">
                    <ScanFace className="mx-auto h-8 w-8 text-accent-strong" aria-hidden="true" />
                    <h3 className="mt-3 text-base font-semibold">No result yet</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                      Start the camera and keep one face in view. If FaceRecall is not confident, it
                      will say so rather than guess.
                    </p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="How certainty is handled" />
            <CardBody>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                  Similarity scores are not probabilities, so you will not see a "97% sure" figure.
                </li>
                <li className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                  An accepted match needs to pass your threshold and, when enabled, beat the
                  runner-up by your ambiguity margin.
                </li>
                <li className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                  {settings
                    ? `Current threshold ${settings.recognition_threshold.toFixed(2)}, margin ${settings.ambiguity_margin.toFixed(2)}.`
                    : "Loading your thresholds…"}
                </li>
              </ul>
              <Link
                to="/settings"
                className="mt-3 inline-flex text-sm font-semibold text-accent-strong underline-offset-4 hover:underline"
              >
                Open recognition settings
              </Link>
            </CardBody>
          </Card>
        </section>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Record this interaction?"
        description="Only confirmed meetings appear in your history. You can edit or delete this entry later."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmMatch()} loading={saving}>
              Save interaction
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Recording a confirmed interaction with{" "}
            <strong className="font-semibold">{result?.person?.name}</strong>. This updates their
            "last confirmed interaction" date.
          </p>
          <div>
            <label htmlFor="occurred-at" className="block text-sm font-semibold text-ink">
              When did you meet?
            </label>
            <input
              id="occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-base"
            />
          </div>
          <TextareaField
            id="interaction-note"
            label="Note"
            hint="Optional. A detail you want to remember next time."
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </Dialog>

      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report a wrong match"
        description="FaceRecall has no vendor backend to send reports to, so this panel tells you exactly how to fix the cause."
        footer={<Button onClick={() => setReportOpen(false)}>Close</Button>}
      >
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            Nothing is uploaded from this dialog. Everything you can change lives in your own local
            data:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Add another enrolment photo with a different angle or expression —{" "}
              <Link
                to={result?.person ? `/people/${result.person.id}` : "/people"}
                className="font-semibold text-accent-strong underline-offset-4 hover:underline"
              >
                open the person profile
              </Link>
              .
            </li>
            <li>
              Raise the threshold or increase the ambiguity margin in{" "}
              <Link
                to="/settings"
                className="font-semibold text-accent-strong underline-offset-4 hover:underline"
              >
                Recognition settings
              </Link>{" "}
              so borderline scores are rejected.
            </li>
            <li>
              If the face was not detected at all, improve the lighting and keep one face in frame.
            </li>
          </ul>
          <p className="rounded-control bg-surface-muted px-3 py-2 text-xs text-muted">
            A dismissed match never writes an interaction. Your history only contains entries you
            confirmed.
          </p>
        </div>
      </Dialog>

      {!settings ? (
        <p className="mt-4 text-sm text-muted">Loading recognition settings…</p>
      ) : null}
      {settings && !speech.supported ? (
        <p className="mt-4 text-sm text-muted">
          Voice output is unavailable in this browser. Text results work normally.
        </p>
      ) : null}
      {settings && speech.supported && voiceEnabled ? (
        <p className="mt-4 text-sm text-muted">
          Voice output is on. Names are only spoken after a match is accepted.
        </p>
      ) : null}
      <p className="mt-6 text-xs text-muted">
        Last frame checked: {lastChecked ? formatDateTime(lastChecked) : "not yet"} · Model:{" "}
        {outcome?.model_name ?? "not loaded"}
        {outcome?.is_simulated ? " (simulated)" : ""}
      </p>
    </div>
  );
}
