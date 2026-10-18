import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ImagePlus, Info, Trash2 } from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { PersonForm, type PersonFormValues } from "../components/app/PersonForm";
import { PhotoPicker, type PickedPhoto } from "../components/app/PhotoPicker";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody, CardHeader } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { ErrorState } from "../components/ui/empty-state";
import { LoadingBlock } from "../components/ui/spinner";
import { useToast } from "../components/ui/toast";
import { useAsync } from "../hooks/useAsync";
import { formatDate } from "../lib/format";
import { peopleService } from "../services/people";
import type { PersonDetail } from "../types/api";

export function PersonEditPage() {
  const { id } = useParams();
  const personId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();

  const { data, error, loading, reload } = useAsync<PersonDetail>(
    (signal) => peopleService.get(personId, signal),
    [personId],
  );

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const initialValues = useMemo<PersonFormValues | undefined>(() => {
    if (!data) return undefined;
    return {
      name: data.name,
      relationship: data.relationship ?? "",
      where_met: data.where_met ?? "",
      organization_or_group: data.organization_or_group ?? "",
      notes: data.notes ?? "",
      reminder: data.reminder ?? "",
    };
  }, [data]);

  if (loading && !data) return <LoadingBlock label="Loading profile" />;
  if (error) {
    return <ErrorState title="Profile unavailable" description={(error as Error).message} onRetry={reload} />;
  }
  if (!data) return null;

  const remaining = 3 - data.enrollments.length - photos.length;

  const save = async (values: PersonFormValues) => {
    setSaving(true);
    try {
      const clean = (value: string) => (value.trim() ? value.trim() : null);
      await peopleService.update(personId, {
        name: values.name.trim(),
        relationship: clean(values.relationship),
        where_met: clean(values.where_met),
        organization_or_group: clean(values.organization_or_group),
        notes: clean(values.notes),
        reminder: clean(values.reminder),
      });

      let enrolled = 0;
      const failures: string[] = [];
      for (const photo of photos) {
        try {
          await peopleService.enroll(personId, photo.file, photo.file.name);
          enrolled += 1;
        } catch (cause) {
          failures.push((cause as Error).message);
        }
      }

      setDirty(false);
      if (failures.length) {
        toast.push(`Saved, but ${failures.length} photo(s) failed: ${failures[0]}`, "error");
      } else if (enrolled > 0) {
        toast.push(`Profile saved and ${enrolled} new photo(s) enrolled.`, "success");
      } else {
        toast.push("Profile saved.", "success");
      }
      navigate(`/people/${personId}`);
    } catch (cause) {
      toast.push((cause as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    navigate(`/people/${personId}`);
  };

  const removeEnrollment = async () => {
    if (removeTarget === null) return;
    setRemoving(true);
    try {
      await peopleService.removeEnrollment(personId, removeTarget);
      toast.push("Enrolment photo removed. Stored face data for it was deleted.", "success");
      setRemoveTarget(null);
      setDirty(true);
      reload();
    } catch (cause) {
      toast.push((cause as Error).message, "error");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Edit profile"
        title={data.name}
        description="Update the context you rely on. Changes to enrolment photos recalculate the stored face representation."
        actions={
          <Link
            to={`/people/${personId}`}
            className="inline-flex min-h-[44px] items-center rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
          >
            Back to profile
          </Link>
        }
      />

      <div className="mb-5 flex items-start gap-2 rounded-card border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
        <p>
          Adding or removing a photo changes the biometric template stored for {data.name}. The
          model and preprocessing versions stored with each enrolment must match the installed model
          — mismatched enrolments are skipped during recognition rather than guessed at.
        </p>
      </div>

      <div ref={formRef} onChange={() => setDirty(true)}>
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <PersonForm
              initialValues={initialValues}
              onSubmit={save}
              submitLabel={saving ? "Saving…" : "Save changes"}
              submitting={saving}
              footerExtra={
                <Button variant="secondary" onClick={cancel} disabled={saving}>
                  Cancel
                </Button>
              }
            >
              <div className="space-y-4">
                <section aria-labelledby="existing-enrollments">
                  <h2 id="existing-enrollments" className="text-sm font-semibold text-ink">
                    Stored enrolment photos ({data.enrollments.length})
                  </h2>
                  {data.enrollments.length === 0 ? (
                    <p className="mt-1 text-sm text-muted">
                      No enrolment photos yet. Add one to three so this person can be recognised.
                    </p>
                  ) : (
                    <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                      {data.enrollments.map((enrollment) => (
                        <li
                          key={enrollment.id}
                          className="rounded-card border border-line bg-surface p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge tone="neutral">#{enrollment.id}</Badge>
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(enrollment.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-control text-danger hover:bg-danger-soft"
                              aria-label={`Remove enrolment ${enrollment.id}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-muted">
                            Added {formatDate(enrollment.created_at)}
                          </p>
                          <p className="text-xs text-muted">
                            {enrollment.model_name} {enrollment.model_version} ·{" "}
                            {enrollment.embedding_dim}-D
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <PhotoPicker
                  photos={photos}
                  onChange={setPhotos}
                  max={Math.max(1, remaining)}
                  disabled={saving || remaining <= 0}
                />
                {remaining <= 0 ? (
                  <p className="text-sm text-muted">
                    This person already has three enrolment photos, which is the current limit.
                  </p>
                ) : null}
              </div>
            </PersonForm>
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove this enrolment photo?"
        description="The stored face representation and preview for this photo will be deleted. The profile and its history stay."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>
              Keep photo
            </Button>
            <Button variant="danger" onClick={() => void removeEnrollment()} loading={removing}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove photo
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          If this photo is one of only a few, removing it can reduce recognition quality. Consider
          replacing it with a clearer photo instead.
        </p>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          You can add a replacement photo on this page before saving.
        </p>
      </Dialog>
    </div>
  );
}
