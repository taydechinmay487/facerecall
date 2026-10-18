import { Link } from "react-router-dom";
import { Clock, ImageOff, MapPin, ShieldAlert } from "lucide-react";

import { cn } from "../../lib/cn";
import { formatRelative, plural } from "../../lib/format";
import type { PersonSummary } from "../../types/api";
import { Badge } from "../ui/badge";
import { PersonAvatar } from "./PersonAvatar";

export function PersonCard({
  person,
  readOnly = false,
  className,
}: {
  person: PersonSummary;
  readOnly?: boolean;
  className?: string;
}) {
  const contextLine = [person.where_met, person.organization_or_group].filter(Boolean).join(" · ");

  const body = (
    <>
      <div className="flex items-start gap-3">
        <PersonAvatar name={person.name} avatarUrl={person.avatar_url} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink">{person.name}</h3>
            {readOnly ? <Badge tone="caution">Demo</Badge> : null}
          </div>
          <p className="text-sm text-ink-soft">
            {person.relationship ?? "Relationship not recorded"}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted">
        {contextLine || "No context recorded yet. Add where you met or a memory cue."}
      </p>

      <div className="mt-3 space-y-1.5 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Last confirmed: <span className="text-ink-soft">{formatRelative(person.last_confirmed_interaction_at)}</span>
          </span>
        </p>
        <p className="flex items-center gap-1.5">
          {person.enrollment_count > 0 ? (
            <>
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {person.enrollment_count} {plural(person.enrollment_count, "enrolment photo")}
              </span>
            </>
          ) : (
            <>
              <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
              <span>No enrolment photos yet</span>
            </>
          )}
        </p>
        {!person.consent_status ? (
          <p className="flex items-center gap-1.5 font-medium text-danger">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Consent withdrawn — face data removed
          </p>
        ) : null}
      </div>
    </>
  );

  if (readOnly) {
    return (
      <div className={cn("surface-card p-4", className)} aria-label={`${person.name} (demo profile)`}>
        {body}
      </div>
    );
  }

  return (
    <Link
      to={`/people/${person.id}`}
      className={cn(
        "surface-card block p-4 transition-colors duration-150 hover:border-accent/40 hover:bg-accent-soft/20",
        className,
      )}
    >
      {body}
      <span className="mt-3 block text-sm font-semibold text-accent-strong">
        Open profile<span className="visually-hidden"> for {person.name}</span> →
      </span>
    </Link>
  );
}
