import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Clock,
  History,
  ImagePlus,
  Info,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { PersonAvatar } from "../components/app/PersonAvatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody, CardHeader } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { ErrorState } from "../components/ui/empty-state";
import { LoadingBlock } from "../components/ui/spinner";
import { useToast } from "../components/ui/toast";
import { useAsync } from "../hooks/useAsync";
import { formatDate, formatDateTime, formatRelative, plural } from "../lib/format";
import { interactionService } from "../services/interactions";
import { peopleService } from "../services/people";
import type { PersonDetail } from "../types/api";

export function PersonProfilePage() {
  const { id } = useParams();
  const personId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);

  const person = useAsync<PersonDetail>((signal) => peopleService.get(personId, signal), [personId]);
  const history = useAsync(
    (signal) => interactionService.list({ person_id: personId, limit: 5 }, signal),
    [personId],
  );

  if (person.loading && !person.data) return <LoadingBlock label="Loading profile" />;
  if (person.error) {
    return (
      <ErrorState
        title="Profile unavailable"
        description={(person.error as Error).message}
        onRetry={person.reload}
      />
    );
  }
  const data = person.data;
  if (!data) return null;

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      await peopleService.enroll(personId, file, file.name);
      toast.push("Enrolment photo added. The face representation was recalculated.", "success");
      person.reload();
    } catch (error) {
      toast.push((error as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const withdrawConsent = async () => {
    setWorking(true);
    try {
      const result = await peopleService.withdrawConsent(personId);
      toast.push(result.message, "success");
      setConsentOpen(false);
      person.reload();
    } catch (error) {
      toast.push((error as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };

  const deleteProfile = async () => {
    setWorking(true);
    try {
      await peopleService.remove(personId);
      toast.push(`${data.name} and all linked biometric records were deleted.`, "success");
      navigate("/people");
    } catch (error) {
      toast.push((error as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Person profile"
        title={data.name}
        description={data.relationship ?? "Relationship not recorded"}
        actions={
          <>
            <Link
              to={`/people/${personId}/edit`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit profile
            </Link>
            <Link
              to={`/history?person=${personId}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              Interaction history
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader
            title="Context you recorded"
            action={
              <div className="flex flex-wrap gap-2">
                {data.consent_status ? (
                  <Badge tone="success">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Consent recorded {formatDate(data.consent_recorded_at)}
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Consent withdrawn
                  </Badge>
                )}
              </div>
            }
          />
          <CardBody>
            <div className="flex items-start gap-4">
              <PersonAvatar name={data.name} avatarUrl={data.avatar_url} size="lg" />
              <dl className="flex-1 space-y-3 text-sm">
                {[
                  ["Relationship", data.relationship],
                  ["Where you met", data.where_met],
                  ["Workplace or group", data.organization_or_group],
                  ["Notes and cues", data.notes],
                  ["Reminder", data.reminder],
                ].map(([label, value]) => (
                  <div key={label as string} className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="text-ink">
                      {value || <span className="text-muted">Not recorded</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Created
                </dt>
                <dd>{formatDate(data.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Last updated
                </dt>
                <dd>{formatDate(data.updated_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Last confirmed interaction
                </dt>
                <dd>
                  {data.last_confirmed_interaction_at ? (
                    <>
                      {formatDate(data.last_confirmed_interaction_at)}{" "}
                      <span className="text-muted">
                        ({formatRelative(data.last_confirmed_interaction_at)})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">Not recorded</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Interactions logged
                </dt>
                <dd>{data.interaction_count}</dd>
              </div>
            </dl>

            <p className="mt-4 flex items-start gap-2 rounded-control bg-surface-muted px-3 py-2 text-xs text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              FaceRecall never guesses a last-met date. An entry appears here only when you confirm
              an interaction.
            </p>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Enrolment status"
              description={`${data.enrollments.length} of 3 ${plural(data.enrollments.length, "photo")} stored.`}
            />
            <CardBody>
              {data.consent_status ? (
                <>
                  {data.enrollments.length === 0 ? (
                    <p className="text-sm text-muted">
                      No face data stored yet. Add one to three photos so this person can be
                      recognised.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.enrollments.map((enrollment) => (
                        <li
                          key={enrollment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-ink">Enrolment #{enrollment.id}</span>
                          <span className="text-xs text-muted">
                            {enrollment.model_name} {enrollment.model_version} ·{" "}
                            {enrollment.embedding_dim}-D · added {formatDate(enrollment.created_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {data.enrollments.length < 3 ? (
                    <div className="mt-4">
                      <input
                        id="profile-photo-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="visually-hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadPhoto(file);
                          event.target.value = "";
                        }}
                      />
                      <label
                        htmlFor="profile-photo-input"
                        className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted ${
                          uploading ? "opacity-60" : ""
                        }`}
                      >
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        {uploading ? "Enrolling photo…" : "Add enrolment photo"}
                      </label>
                      <p className="mt-2 text-xs text-muted">
                        Front-facing, evenly lit photos work best. The photo is reduced to a small
                        preview; the original upload is not kept.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">
                  Consent has been withdrawn, so no face data is stored. Re-record consent and add a
                  photo to enrol this person again.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent confirmed interactions"
              action={
                <Link
                  to={`/history?person=${personId}`}
                  className="text-sm font-semibold text-accent-strong underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              }
            />
            <CardBody>
              {history.data && history.data.items.length > 0 ? (
                <ul className="divide-y divide-line">
                  {history.data.items.map((entry) => (
                    <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          {formatDateTime(entry.occurred_at)}
                        </p>
                        <Badge tone={entry.event_source === "manual" ? "neutral" : "accent"}>
                          {entry.event_source === "manual" ? "Manual" : "Recognition-assisted"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted">{entry.user_note ?? "No note added"}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  No confirmed interactions recorded yet.
                </p>
              )}
            </CardBody>
          </Card>

          <Card className="border-danger/30">
            <CardHeader
              title="Privacy controls for this person"
              description="These actions are immediate and cannot be undone."
            />
            <CardBody>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="dangerOutline"
                  onClick={() => setConsentOpen(true)}
                  disabled={!data.consent_status}
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  Withdraw consent and delete face data
                </Button>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete profile
                </Button>
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted">
                <ImagePlus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Withdrawing consent deletes the stored face representations and previews. Deleting
                the profile also removes its interaction history.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        title={`Withdraw consent for ${data.name}?`}
        description="All stored face representations and preview images for this person will be deleted immediately."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConsentOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void withdrawConsent()} loading={working}>
              Withdraw consent
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          The profile and any interaction history remain, but FaceRecall will no longer be able to
          recognise this person until consent is recorded again and new photos are enrolled.
        </p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${data.name}?`}
        description="This removes the profile, all enrolment photos and previews, and the linked interaction history."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void deleteProfile()} loading={working}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete permanently
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>{data.enrollments.length} stored face {plural(data.enrollments.length, "representation")}</li>
          <li>{data.interaction_count} interaction {plural(data.interaction_count, "entry", "entries")}</li>
          <li>Any stored preview images for this person</li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          FaceRecall cannot recover deleted biometric data. There is no undo.
        </p>
      </Dialog>
    </div>
  );
}
