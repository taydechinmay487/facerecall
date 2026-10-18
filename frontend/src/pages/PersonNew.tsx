import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ShieldCheck } from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { PersonForm, toPersonInput, type PersonFormValues } from "../components/app/PersonForm";
import { PhotoPicker, type PickedPhoto } from "../components/app/PhotoPicker";
import { Button } from "../components/ui/button";
import { Card, CardBody, CardHeader } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { useToast } from "../components/ui/toast";
import { useCamera } from "../hooks/useCamera";
import { peopleService } from "../services/people";

export function PersonNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const camera = useCamera();

  const [consent, setConsent] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  const openCapture = async () => {
    setCaptureOpen(true);
    await camera.start(camera.deviceId || undefined);
  };

  const closeCapture = () => {
    camera.stop();
    setCaptureOpen(false);
  };

  const takePhoto = async () => {
    const blob = await camera.captureFrame();
    if (!blob) {
      toast.push("The camera is not ready yet. Wait a moment and try again.", "error");
      return;
    }
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPhotos((current) => [
      ...current,
      { id: `capture-${Date.now()}`, file, url: URL.createObjectURL(blob) },
    ]);
    closeCapture();
    toast.push("Photo captured. Review it before saving.", "success");
  };

  const submit = async (values: PersonFormValues) => {
    setSubmitting(true);
    try {
      const person = await peopleService.create(toPersonInput(values, consent));
      const failures: string[] = [];
      for (const photo of photos) {
        try {
          await peopleService.enroll(person.id, photo.file, photo.file.name);
        } catch (error) {
          failures.push((error as Error).message);
        }
      }

      if (failures.length > 0) {
        toast.push(
          `${person.name} was saved, but ${failures.length} photo(s) could not be enrolled: ${failures[0]}`,
          "error",
        );
      } else if (photos.length === 0) {
        toast.push(
          `${person.name} was saved. Add 1–3 photos so FaceRecall can recognise them.`,
          "info",
        );
      } else {
        toast.push(`${person.name} was enrolled with ${photos.length} photo(s).`, "success");
      }
      navigate(`/people/${person.id}`);
    } catch (error) {
      toast.push((error as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="New profile"
        title="Enrol a person"
        description="Add someone who has agreed to be recognised. You can edit every field later, and withdraw consent at any time."
        actions={
          <Link
            to="/people"
            className="inline-flex min-h-[44px] items-center rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
          >
            Cancel
          </Link>
        }
      />

      <div className="mb-5 rounded-card border border-accent/30 bg-accent-soft px-4 py-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-accent-strong">Consent comes first</p>
            <p className="text-sm text-ink-soft">
              Face data is sensitive. Ask the person before you enrol them, explain what FaceRecall
              is for, and stop if they are unsure. Withdrawing consent deletes the stored face data
              immediately.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Profile details"
          description="Everything here is something you typed. FaceRecall never infers a relationship or looks anyone up."
        />
        <CardBody>
          <PersonForm
            consentRequired
            consentAccepted={consent}
            onConsentChange={setConsent}
            onSubmit={submit}
            submitLabel="Save profile and enrol"
            submitting={submitting}
            footerExtra={
              <Link
                to="/people"
                className="text-sm font-semibold text-ink-soft underline-offset-4 hover:underline"
              >
                Cancel
              </Link>
            }
          >
            <PhotoPicker
              photos={photos}
              onChange={setPhotos}
              cameraEnabled
              onCameraCapture={() => void openCapture()}
              disabled={submitting}
            />
          </PersonForm>
        </CardBody>
      </Card>

      <Dialog
        open={captureOpen}
        onClose={closeCapture}
        title="Capture an enrolment photo"
        description="Ask the person to face the light and look at the camera. Nothing is stored until you press Capture."
        footer={
          <>
            <Button variant="secondary" onClick={closeCapture}>
              Cancel
            </Button>
            <Button onClick={() => void takePhoto()}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              Capture
            </Button>
          </>
        }
      >
        <video
          ref={camera.videoRef}
          className="aspect-video w-full rounded-card bg-ink object-cover"
          muted
          playsInline
          aria-label="Camera preview for enrolment photo"
        />
        {camera.issue ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {camera.issue.message} {camera.issue.help}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
