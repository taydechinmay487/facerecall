import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Database,
  Download,
  Info,
  Lock,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Trash2,
  Volume2,
} from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody, CardHeader } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { SelectField, TextField } from "../components/ui/field";
import { Switch } from "../components/ui/switch";
import { useToast } from "../components/ui/toast";
import { useAsync } from "../hooks/useAsync";
import { useCamera } from "../hooks/useCamera";
import { useSettings } from "../hooks/useSettings";
import { useSpeech } from "../hooks/useSpeech";
import { interactionService } from "../services/interactions";
import { settingsService } from "../services/settings";
import { systemService } from "../services/system";

const TEXT_SCALES = [
  { value: "0.9", label: "Compact (90%)" },
  { value: "1", label: "Default (100%)" },
  { value: "1.15", label: "Comfortable (115%)" },
  { value: "1.3", label: "Large (130%)" },
];

export function SettingsPage() {
  const { settings, loading, error, update, reload } = useSettings();
  const toast = useToast();
  const speech = useSpeech();
  const camera = useCamera();
  const diagnostics = useAsync((signal) => settingsService.diagnostics(signal), []);
  const status = useAsync((signal) => systemService.status(signal), []);

  const [working, setWorking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [includeDemo, setIncludeDemo] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [cameraCheck, setCameraCheck] = useState<string | null>(null);

  const patch = async (values: Parameters<typeof update>[0], message: string) => {
    try {
      await update(values);
      toast.push(message, "success");
    } catch (cause) {
      toast.push((cause as Error).message, "error");
    }
  };

  const checkCamera = async () => {
    setCameraCheck("Requesting permission…");
    const ok = await camera.start(camera.deviceId || undefined);
    if (ok) {
      const count = camera.devices.length;
      setCameraCheck(
        count > 1
          ? `Permission granted. ${count} cameras detected; choose one below.`
          : "Permission granted. One camera is available.",
      );
    } else {
      setCameraCheck(null);
    }
  };

  const exportData = async () => {
    setWorking(true);
    try {
      const { blob, filename } = await systemService.exportData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.push("Export downloaded. It contains biometric embeddings — store it securely.", "success");
    } catch (cause) {
      toast.push((cause as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };

  const clearHistory = async () => {
    setWorking(true);
    try {
      const result = await interactionService.clear();
      toast.push(`${result.deleted} interaction entries deleted.`, "success");
      setClearOpen(false);
    } catch (cause) {
      toast.push((cause as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };

  const deleteEverything = async () => {
    setWorking(true);
    try {
      const result = await systemService.deleteAll(confirmText, includeDemo);
      toast.push(result.message, "success");
      setDeleteOpen(false);
      setConfirmText("");
      reload();
    } catch (cause) {
      toast.push((cause as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };

  if (loading && !settings) {
    return <p className="text-sm text-muted">Loading settings…</p>;
  }

  if (error || !settings) {
    return (
      <Card>
        <CardBody>
          <p role="alert" className="text-sm text-danger">
            {error ?? "Settings could not be loaded."}
          </p>
          <Button variant="secondary" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </CardBody>
      </Card>
    );
  }

  const engineReady = status.data?.engine.mode === "real";

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Settings and privacy"
        description="Recognition behaviour, camera, voice, display and data controls. Defaults are starting points, not calibrated values."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Recognition"
            description="How strict FaceRecall must be before it shows a person."
            action={
              engineReady ? (
                <Badge tone="success">Real model installed</Badge>
              ) : (
                <Badge tone="caution">Models not installed</Badge>
              )
            }
          />
          <CardBody className="space-y-6">
            <div>
              <label htmlFor="threshold" className="block text-sm font-semibold text-ink">
                Acceptance threshold: {settings.recognition_threshold.toFixed(2)}
              </label>
              <p id="threshold-help" className="mt-1 text-sm text-muted">
                Minimum cosine similarity between the detected face and an enrolled person. Higher is
                stricter. Leave the default until you have tested with your own photos.
              </p>
              <input
                id="threshold"
                type="range"
                min={0.2}
                max={0.9}
                step={0.01}
                value={settings.recognition_threshold}
                aria-describedby="threshold-help"
                onChange={(event) =>
                  void patch(
                    { recognition_threshold: Number(event.target.value) },
                    "Threshold updated.",
                  )
                }
                className="mt-3 w-full"
              />
            </div>

            <div>
              <label htmlFor="margin" className="block text-sm font-semibold text-ink">
                Ambiguity margin: {settings.ambiguity_margin.toFixed(2)}
              </label>
              <p id="margin-help" className="mt-1 text-sm text-muted">
                How much the best candidate must beat the runner-up. Set to 0 to disable. When two
                people are close, a margin above zero produces "Not confident" instead of a guess.
              </p>
              <input
                id="margin"
                type="range"
                min={0}
                max={0.3}
                step={0.01}
                value={settings.ambiguity_margin}
                aria-describedby="margin-help"
                onChange={(event) =>
                  void patch({ ambiguity_margin: Number(event.target.value) }, "Margin updated.")
                }
                className="mt-3 w-full"
              />
            </div>

            <SelectField
              id="frame-interval"
              label="Frame processing interval"
              hint="Longer intervals use less CPU and reduce battery drain."
              value={String(settings.frame_interval_ms)}
              onChange={(event) =>
                void patch({ frame_interval_ms: Number(event.target.value) }, "Interval updated.")
              }
            >
              {[300, 500, 700, 1000, 1500, 2000].map((value) => (
                <option key={value} value={value}>
                  {value} ms
                </option>
              ))}
            </SelectField>

            {diagnostics.data ? (
              <div className="rounded-card border border-line bg-surface-muted p-4 text-sm">
                <p className="font-semibold text-ink">Detection and model status</p>
                <ul className="mt-2 space-y-1 text-muted">
                  <li>Detector: {diagnostics.data.engine.detector_name}</li>
                  <li>
                    Embedding model: {diagnostics.data.engine.model_name}{" "}
                    {diagnostics.data.engine.model_version}
                    {diagnostics.data.engine.embedding_dim
                      ? ` (${diagnostics.data.engine.embedding_dim}-D, ${diagnostics.data.engine.similarity_metric})`
                      : ""}
                  </li>
                  <li>{diagnostics.data.engine.message}</li>
                </ul>
                <p className="mt-2 text-xs text-muted">{diagnostics.data.note}</p>
              </div>
            ) : null}

            <p className="flex items-start gap-2 text-xs text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              FaceRecall never shows similarity as a percentage of certainty, because a similarity
              score is not a probability.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Camera" description="Permission is only requested when you press a button that needs it." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => void checkCamera()}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                Check camera access
              </Button>
              {camera.status === "ready" ? (
                <Button variant="ghost" onClick={camera.stop}>
                  Release camera
                </Button>
              ) : null}
            </div>
            <p aria-live="polite" className="text-sm text-muted">
              {cameraCheck ??
                (camera.status === "ready"
                  ? "Camera permission granted."
                  : "Camera permission has not been requested yet.")}
            </p>
            {camera.issue ? (
              <div className="rounded-card border border-caution/40 bg-caution-soft p-3 text-sm">
                <p className="font-semibold text-caution">{camera.issue.message}</p>
                <p className="text-ink-soft">{camera.issue.help}</p>
              </div>
            ) : null}
            {camera.devices.length > 1 ? (
              <SelectField
                id="preferred-camera"
                label="Preferred camera"
                hint="Used when you next start a session."
                value={camera.deviceId}
                onChange={(event) => void camera.start(event.target.value)}
              >
                {camera.devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Camera"}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <video
              ref={camera.videoRef}
              className="hidden"
              muted
              playsInline
              aria-hidden="true"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Voice"
            description="Optional spoken output. Names are never spoken unless you switch this on."
          />
          <CardBody className="space-y-5">
            <Switch
              id="voice-enabled"
              label="Speak accepted matches"
              description="When on, FaceRecall reads the name, relationship and where you met after a match is accepted."
              checked={settings.voice_enabled}
              onChange={(next) =>
                void patch({ voice_enabled: next }, next ? "Voice output on." : "Voice output off.")
              }
            />
            <SelectField
              id="voice-name"
              label="Voice"
              disabled={!speech.supported || speech.voices.length === 0}
              value={settings.speech_voice ?? ""}
              onChange={(event) =>
                void patch({ speech_voice: event.target.value || null }, "Voice updated.")
              }
            >
              <option value="">System default</option>
              {speech.voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </SelectField>
            <div>
              <label htmlFor="speech-rate" className="block text-sm font-semibold text-ink">
                Speech rate: {settings.speech_rate.toFixed(1)}×
              </label>
              <input
                id="speech-rate"
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={settings.speech_rate}
                onChange={(event) =>
                  void patch({ speech_rate: Number(event.target.value) }, "Speech rate updated.")
                }
                className="mt-3 w-full"
              />
            </div>
            <Button
              variant="secondary"
              disabled={!speech.supported}
              onClick={() =>
                speech.speak("FaceRecall voice test. This is Maya Rodrigues, your neighbour.", {
                  rate: settings.speech_rate,
                  voiceName: settings.speech_voice,
                })
              }
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Test voice
            </Button>
            {!speech.supported ? (
              <p role="status" className="text-sm text-muted">
                This browser does not support speech synthesis. Text results are unaffected.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Display" description="Comfort settings for reading and motion." />
          <CardBody className="space-y-5">
            <SelectField
              id="text-scale"
              label="Text size"
              value={String(settings.text_scale)}
              onChange={(event) =>
                void patch({ text_scale: Number(event.target.value) }, "Text size updated.")
              }
            >
              {TEXT_SCALES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <Switch
              id="reduce-motion"
              label="Reduce motion"
              description="Turn off transitions and animations. Your operating system preference is respected automatically."
              checked={settings.reduce_motion}
              onChange={(next) =>
                void patch({ reduce_motion: next }, next ? "Motion reduced." : "Motion restored.")
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Privacy and data"
            description="What is stored, where it lives, and how to remove it."
            action={<Badge tone="accent">Local only</Badge>}
          />
          <CardBody className="space-y-5">
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex gap-2">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                Profiles, face embeddings, interaction history and settings are stored in a local
                SQLite database ({status.data?.database_backend ?? "sqlite"}).
              </li>
              <li className="flex gap-2">
                <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                Frames are analysed by the FaceRecall service on this machine, one at a time. No
                video and no frame is written to disk.
              </li>
              <li className="flex gap-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                {status.data?.encryption_enabled
                  ? "Stored embeddings are encrypted at rest with the configured key."
                  : "Embeddings are stored unencrypted. Set FACERECALL_ENCRYPTION_KEY to encrypt them at rest."}
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                Embeddings are biometric data. They are not anonymous, and they are never sent to a
                third-party service.
              </li>
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void exportData()} loading={working}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Export my data (JSON)
              </Button>
              <Button variant="secondary" onClick={() => setClearOpen(true)}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Clear interaction history
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete all profiles and biometric data
              </Button>
            </div>

            <Switch
              id="retain-thumbnails"
              label="Keep small preview images"
              description="Preview images make the directory easier to scan. Turning this off stops new previews from being stored; existing ones remain until you delete the profile. The original uploads are never kept."
              checked={settings.retain_thumbnails}
              onChange={(next) =>
                void patch({ retain_thumbnails: next }, "Preview preference updated.")
              }
            />

            <p className="text-sm">
              <Link to="/privacy" className="font-semibold text-accent-strong underline-offset-4 hover:underline">
                Read the full privacy and data-control notes
              </Link>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="About this build" />
          <CardBody>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Application version
                </dt>
                <dd>{status.data?.app_version ?? "0.1.0"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Operation mode
                </dt>
                <dd>
                  {engineReady
                    ? "Real recognition pipeline"
                    : "Models not installed — demo mode or unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Model and library
                </dt>
                <dd>
                  {status.data?.engine.model_name ?? "SFace"}{" "}
                  {status.data?.engine.model_version ?? "2021dec"} · detector{" "}
                  {status.data?.engine.detector_name ?? "YuNet"} · OpenCV inference
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Accounts
                </dt>
                <dd>
                  {status.data?.auth_required
                    ? "Shared token required"
                    : "Single-user local prototype, no accounts"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-2 text-xs text-muted">
              <Sliders className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Known limitations: recognition quality depends on photo quality and lighting;
              thresholds ship uncalibrated; one-to-three enrolment photos is a design target that has
              not been validated against a measured dataset.
            </p>
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear all interaction history?"
        description="Every confirmed interaction entry is deleted. Profiles and enrolment photos stay."
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void clearHistory()} loading={working}>
              Clear history
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          This cannot be undone. Your "last confirmed interaction" dates will reset to blank.
        </p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete everything?"
        description="Profiles, face embeddings, preview images and interaction history are removed, and settings return to defaults."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void deleteEverything()}
              loading={working}
              disabled={confirmText !== "DELETE ALL"}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete all data
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            <li>Every profile and its stored face representations</li>
            <li>All stored preview images under FaceRecall's data directory</li>
            <li>All interaction history entries</li>
            <li>Recognition, voice and display settings</li>
          </ul>
          <TextField
            id="delete-confirm"
            label="Type DELETE ALL to confirm"
            required
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
          />
          <div className="flex items-start gap-2">
            <input
              id="include-demo"
              type="checkbox"
              checked={includeDemo}
              onChange={(event) => setIncludeDemo(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-line"
            />
            <label htmlFor="include-demo" className="text-sm text-ink-soft">
              Also remove the fictional demo profiles
            </label>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
