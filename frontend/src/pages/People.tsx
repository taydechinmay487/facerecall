import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List, Plus, Search, Users } from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { PersonAvatar } from "../components/app/PersonAvatar";
import { PersonCard } from "../components/app/PersonCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody } from "../components/ui/card";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { SelectField, TextField } from "../components/ui/field";
import { LoadingBlock } from "../components/ui/spinner";
import { useAsync } from "../hooks/useAsync";
import { useDemoMode } from "../hooks/useDemoMode";
import { formatRelative, plural } from "../lib/format";
import { peopleService } from "../services/people";

const PAGE_SIZE = 24;

export function PeoplePage() {
  const demo = useDemoMode();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [relationship, setRelationship] = useState("");
  const [sort, setSort] = useState<"name" | "recent">("name");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [debounced, relationship, sort, demo.enabled]);

  const dataset = demo.enabled ? "demo" : "real";
  const { data, error, loading, reload } = useAsync(
    (signal) =>
      peopleService.list(
        {
          q: debounced || undefined,
          relationship: relationship || undefined,
          sort,
          dataset,
          limit,
          offset: 0,
        },
        signal,
      ),
    [debounced, relationship, sort, dataset, limit],
  );

  const relationshipOptions = useMemo(() => data?.relationships ?? [], [data]);
  const hasResults = (data?.items.length ?? 0) > 0;
  const filtering = Boolean(debounced || relationship);

  return (
    <div>
      <PageHeader
        eyebrow="People directory"
        title="Your enrolled people"
        description={
          demo.enabled
            ? "You are browsing the fictional demo dataset. Demo profiles are read-only and never used in real recognition."
            : "Only people who have agreed to be enrolled appear here. Every detail is one you typed."
        }
        actions={
          <Link
            to="/people/new"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a person
          </Link>
        }
      />

      <Card className="mb-5">
        <CardBody>
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            <TextField
              id="people-search"
              label="Search"
              placeholder="Name, relationship or group"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
            />
            <SelectField
              id="people-relationship"
              label="Relationship"
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
            >
              <option value="">All relationships</option>
              {relationshipOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="people-sort"
              label="Sort by"
              value={sort}
              onChange={(event) => setSort(event.target.value as "name" | "recent")}
            >
              <option value="name">Name (A–Z)</option>
              <option value="recent">Recently edited</option>
            </SelectField>
            <div className="flex items-end">
              <div role="group" aria-label="Layout" className="flex gap-1 rounded-control border border-line p-1">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  className={`rounded px-2.5 py-2 ${view === "grid" ? "bg-accent-soft text-accent-strong" : "text-muted"}`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  <span className="visually-hidden">Grid view</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  className={`rounded px-2.5 py-2 ${view === "list" ? "bg-accent-soft text-accent-strong" : "text-muted"}`}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                  <span className="visually-hidden">List view</span>
                </button>
              </div>
            </div>
          </div>
          {data ? (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              {data.total} {plural(data.total, "profile")}
              {filtering ? " matching your filters" : ""}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {loading && !data ? <LoadingBlock label="Loading your directory" /> : null}

      {error ? (
        <ErrorState
          title="Directory unavailable"
          description={(error as Error).message}
          onRetry={reload}
        />
      ) : null}

      {data && !hasResults ? (
        filtering ? (
          <EmptyState
            icon={Search}
            title="No profiles match those filters"
            description="Try a different name, clear the relationship filter, or add a new person."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setRelationship("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title={demo.enabled ? "No demo profiles" : "No profiles yet"}
            description={
              demo.enabled
                ? "Seed the demo dataset from the banner above to explore the interface."
                : "Add someone who has agreed to have their face data stored, then enrol one to three photos."
            }
            action={
              demo.enabled ? null : (
                <Link
                  to="/people/new"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add your first person
                </Link>
              )
            }
          />
        )
      ) : null}

      {hasResults && view === "grid" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data?.items.map((person) => (
            <li key={person.id}>
              <PersonCard person={person} readOnly={demo.enabled} />
            </li>
          ))}
        </ul>
      ) : null}

      {hasResults && view === "list" ? (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {data?.items.map((person) => (
                <li key={person.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <PersonAvatar name={person.name} avatarUrl={person.avatar_url} size="sm" />
                  <div className="min-w-[12rem] flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">
                        {demo.enabled ? (
                          person.name
                        ) : (
                          <Link
                            to={`/people/${person.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {person.name}
                          </Link>
                        )}
                      </h3>
                      {demo.enabled ? <Badge tone="caution">Demo</Badge> : null}
                      {!person.consent_status ? <Badge tone="danger">Consent withdrawn</Badge> : null}
                    </div>
                    <p className="text-sm text-muted">
                      {person.relationship ?? "Relationship not recorded"}
                      {person.where_met ? ` · ${person.where_met}` : ""}
                    </p>
                  </div>
                  <div className="text-xs text-muted">
                    <p>
                      {person.enrollment_count} {plural(person.enrollment_count, "photo")}
                    </p>
                    <p>Last confirmed: {formatRelative(person.last_confirmed_interaction_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {data && data.total > (data.items.length ?? 0) ? (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((value) => value + PAGE_SIZE)} loading={loading}>
            Load more profiles
          </Button>
        </div>
      ) : null}
    </div>
  );
}
