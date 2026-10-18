import { useState, type FormEvent, type ReactNode } from "react";
import { Info } from "lucide-react";

import { Button } from "../ui/button";
import { TextField, TextareaField } from "../ui/field";
import { Switch } from "../ui/switch";
import type { PersonInput } from "../../types/api";

export interface PersonFormValues {
  name: string;
  relationship: string;
  where_met: string;
  organization_or_group: string;
  notes: string;
  reminder: string;
}

export const emptyPersonForm: PersonFormValues = {
  name: "",
  relationship: "",
  where_met: "",
  organization_or_group: "",
  notes: "",
  reminder: "",
};

export function PersonForm({
  initialValues,
  consentRequired,
  consentAccepted,
  onConsentChange,
  onSubmit,
  submitLabel,
  submitting,
  children,
  footerExtra,
}: {
  initialValues?: PersonFormValues;
  consentRequired?: boolean;
  consentAccepted?: boolean;
  onConsentChange?: (next: boolean) => void;
  onSubmit: (values: PersonFormValues) => void | Promise<void>;
  submitLabel: string;
  submitting: boolean;
  children?: ReactNode;
  footerExtra?: ReactNode;
}) {
  const [values, setValues] = useState<PersonFormValues>(initialValues ?? emptyPersonForm);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFormValues | "consent", string>>>({});

  const update = (key: keyof PersonFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = "A name is required so you can find them later.";
    if (consentRequired && !consentAccepted) {
      nextErrors.consent = "Please confirm that this person has agreed to be enrolled.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="person-name"
          label="Name"
          required
          value={values.name}
          error={errors.name}
          autoComplete="off"
          maxLength={120}
          onChange={(event) => update("name", event.target.value)}
        />
        <TextField
          id="person-relationship"
          label="Relationship to you"
          hint="Your own words: colleague, neighbour, physiotherapist…"
          value={values.relationship}
          maxLength={80}
          onChange={(event) => update("relationship", event.target.value)}
        />
        <TextField
          id="person-where-met"
          label="Where you met"
          value={values.where_met}
          maxLength={200}
          onChange={(event) => update("where_met", event.target.value)}
        />
        <TextField
          id="person-org"
          label="Workplace, college or group"
          value={values.organization_or_group}
          maxLength={120}
          onChange={(event) => update("organization_or_group", event.target.value)}
        />
      </div>

      <TextareaField
        id="person-notes"
        label="Notes and memory cues"
        hint="Anything that helps the conversation start: shared interests, family, recent news you know about."
        value={values.notes}
        maxLength={2000}
        rows={4}
        onChange={(event) => update("notes", event.target.value)}
      />

      <TextField
        id="person-reminder"
        label="Reminder for next time"
        hint="Optional. FaceRecall shows this on the match card."
        value={values.reminder}
        maxLength={200}
        onChange={(event) => update("reminder", event.target.value)}
      />

      {children}

      {consentRequired ? (
        <fieldset className="rounded-card border border-line bg-surface-muted p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Consent</legend>
          <div className="flex items-start gap-3">
            <input
              id="consent-confirmed"
              type="checkbox"
              checked={Boolean(consentAccepted)}
              onChange={(event) => {
                onConsentChange?.(event.target.checked);
                setErrors((current) => ({ ...current, consent: undefined }));
              }}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby="consent-help consent-error"
              className="mt-0.5 h-5 w-5 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div>
              <label htmlFor="consent-confirmed" className="text-sm font-medium text-ink">
                This person has agreed to have their face data stored in FaceRecall
              </label>
              <p id="consent-help" className="mt-1 text-sm text-muted">
                Enrol only people who have explicitly consented. FaceRecall never collects photos from
                social media or any public source, and never sends biometric data to a third party.
              </p>
              {errors.consent ? (
                <p id="consent-error" role="alert" className="mt-1 text-sm font-medium text-danger">
                  {errors.consent}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {footerExtra}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Only information you type is stored. FaceRecall does not look anything up about people.
      </p>
    </form>
  );
}

export function toPersonInput(
  values: PersonFormValues,
  consentConfirmed: boolean,
): PersonInput {
  const clean = (value: string) => (value.trim() ? value.trim() : null);
  return {
    name: values.name.trim(),
    relationship: clean(values.relationship),
    where_met: clean(values.where_met),
    organization_or_group: clean(values.organization_or_group),
    notes: clean(values.notes),
    reminder: clean(values.reminder),
    consent_confirmed: consentConfirmed,
  };
}
