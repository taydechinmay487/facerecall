import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, Clock, History as HistoryIcon, Pencil, Trash2 } from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody, CardHeader } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { SelectField, TextField, TextareaField } from "../components/ui/field";
import { LoadingBlock } from "../components/ui/spinner";
import { useToast } from "../components/ui/toast";
import { useAsync } from "../hooks/useAsync";
import { formatDateTime, toDateTimeInputValue } from "../lib/format";
import { interactionService } from "../services/interactions";
import { peopleService } from "../services/people";
import type { InteractionRead } from "../types/api";

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [personId, setPersonId] = useState<string>(searchParams.get("person") ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [editTarget, setEditTarget] = useState<InteractionRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InteractionRead | null>(null);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams();
    if (personId) next.set("person", personId);
    setSearchParams(next, { replace: true });
  }, [personId, setSearchParams]);

  const people = useAsync((signal) => peopleService.list({ limit: 200 }, signal), []);
  const history = useAsync(
    (signal) =>
      interactionService.list(
        {
          person_id: personId ? Number(personId) : undefined,
          start: start ? new Date(`${start}T00:00:00`).toISOString() : undefined,
          end: end ? new Date(`${end}T23:59:59`).toISOString() : undefined,
          limit: 100,
        },
        signal,
      ),
    [personId, start, end],
  );

  const openEdit = (entry: InteractionRead) => {
    setEditTarget(entry);
    setNote(entry.user_note ?? "");
    setOccurredAt(toDateTimeInputValue(entry.occurred_at));
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setWorking(true);
    try {
      await interactionService.update(editTarget.id, {
        user_note: note.trim() || null,
        occurred_at: new Date(occurredAt).toISOString(),
      });
      toast.push("Interaction updated.", "success");
      setEditTarget(null);
      history.reload();
    } catch (error) {
      toast.push((error as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setWorking(true);
    try {
      await interactionService.remove(deleteTarget.id);
      toast.push("Interaction deleted.", "success");
      setDeleteTarget(null);
      history.reload();
    } catch (error) {
      toast.push((error as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };

  const filtering = Boolean(personId || start || end);

  return (
    <div>
      <PageHeader
        eyebrow="Interaction history"
        title="Confirmed interactions"
        description="A meeting is recorded only when you confirm it. Recognition alone never writes history."
      />

      <Card className="mb-5">
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              id="history-person"
              label="Person"
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
            >
              <option value="">Everyone</option>
              {people.data?.items.map((person) => (
                <option key={person.id} value={String(person.id)}>
                  {person.name}
                </option>
              ))}
            </SelectField>
            <TextField
              id="history-start"
              label="From"
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
            <TextField
              id="history-end"
              label="To"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </div>
          {history.data ? (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              {history.data.total} {history.data.total === 1 ? "entry" : "entries"}
              {filtering ? " matching your filters" : ""}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {history.loading && !history.data ? <LoadingBlock label="Loading history" /> : null}

      {history.error ? (
        <ErrorState
          title="History unavailable"
          description={(history.error as Error).message}
          onRetry={history.reload}
        />
      ) : null}

      {history.data && history.data.items.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={filtering ? "No entries match those filters" : "No interactions recorded yet"}
          description={
            filtering
              ? "Try widening the date range or choosing a different person."
              : "Confirm a match during a recognition session, or add an interaction from a profile, and it will appear here."
          }
          action={
            filtering ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setPersonId("");
                  setStart("");
                  setEnd("");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Link
                to="/recognize"
                className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                Start a recognition session
              </Link>
            )
          }
        />
      ) : null}

      {history.data && history.data.items.length > 0 ? (
        <Card>
          <CardHeader title="Entries" description="Newest first." />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {history.data.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/people/${entry.person_profile_id}`}
                        className="text-sm font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {entry.person_name}
                      </Link>
                      <Badge tone={entry.event_source === "manual" ? "neutral" : "accent"}>
                        {entry.event_source === "manual" ? "Manually entered" : "Recognition-assisted"}
                      </Badge>
                      {entry.confirmation_status === "corrected" ? (
                        <Badge tone="caution">Corrected</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDateTime(entry.occurred_at)}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">{entry.user_note ?? "No note added"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(entry)}
                      aria-label={`Edit interaction with ${entry.person_name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(entry)}
                      aria-label={`Delete interaction with ${entry.person_name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Dialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit interaction"
        description="Correct the date or note. Both stay attached to the same person."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} loading={working}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-occurred" className="block text-sm font-semibold text-ink">
              When did you meet?
            </label>
            <input
              id="edit-occurred"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-base"
            />
          </div>
          <TextareaField
            id="edit-note"
            label="Note"
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this interaction?"
        description="The entry disappears from history and the person's last confirmed date is recalculated."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={working}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete entry
            </Button>
          </>
        }
      >
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {deleteTarget ? `${deleteTarget.person_name} · ${formatDateTime(deleteTarget.occurred_at)}` : ""}
        </p>
      </Dialog>
    </div>
  );
}
