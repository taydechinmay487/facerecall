import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ImagePlus,
  Plus,
  ScanFace,
  Sparkles,
  Users,
} from "lucide-react";

import { PageHeader } from "../components/app/PageHeader";
import { PersonCard } from "../components/app/PersonCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody, CardHeader } from "../components/ui/card";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { LoadingBlock } from "../components/ui/spinner";
import { useAsync } from "../hooks/useAsync";
import { useDemoMode } from "../hooks/useDemoMode";
import { formatDateTime, formatRelative, plural } from "../lib/format";
import { systemService } from "../services/system";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        <Icon className="h-4 w-4 text-accent-strong" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function DashboardPage() {
  const demo = useDemoMode();
  const { data, error, loading, reload } = useAsync((signal) => systemService.dashboard(signal), []);

  if (loading && !data) return <LoadingBlock label="Loading your dashboard" />;

  if (error) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        description={(error as Error).message}
        onRetry={reload}
      />
    );
  }

  if (!data) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Welcome back"
        description="Your enrolled people, the context you have recorded, and confirmed interactions — all calculated from your local records."
        actions={
          <>
            <Link
              to="/recognize"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
            >
              <ScanFace className="h-4 w-4" aria-hidden="true" />
              Start recognition
            </Link>
            <Link
              to="/people/new"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a person
            </Link>
          </>
        }
      />

      {data.first_use ? (
        <section aria-labelledby="onboarding-heading" className="mb-6">
          <Card>
            <CardHeader
              id="onboarding-heading"
              title="Let's set up your first person"
              description="FaceRecall only recognises people you have deliberately enrolled. Three short steps and you can try a camera session."
            />
            <CardBody>
              <ol className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "Add a profile",
                    body: "Name, relationship and any context you want to recall.",
                  },
                  {
                    title: "Enrol 1–3 photos",
                    body: "Front-facing photos in even light work best. Only with consent.",
                  },
                  {
                    title: "Try recognition",
                    body: "Start the camera and confirm whether the match was right.",
                  },
                ].map((step, index) => (
                  <li key={step.title} className="rounded-card border border-line bg-canvas p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
                      Step {index + 1}
                    </span>
                    <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted">{step.body}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/people/new"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add your first person
                </Link>
                {!demo.enabled ? (
                  <Button variant="secondary" onClick={() => void demo.enable()} loading={demo.busy}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Explore with fictional demo data
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </section>
      ) : null}

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Enrolled people"
          value={String(data.total_people)}
          hint={`${data.total_enrollments} ${plural(data.total_enrollments, "face enrolment")}`}
          icon={Users}
        />
        <StatCard
          label="With context filled in"
          value={`${data.people_with_complete_context} / ${data.total_people}`}
          hint="At least three context fields completed"
          icon={CheckCircle2}
        />
        <StatCard
          label="Confirmed interactions"
          value={String(data.total_interactions)}
          hint={`${data.interactions_last_30_days} in the last 30 days`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Demo profiles"
          value={String(data.demo_people)}
          hint="Fictional, kept separate from your records"
          icon={Sparkles}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section aria-labelledby="recent-people">
          <Card>
            <CardHeader
              id="recent-people"
              title="Recent profiles"
              description="Ordered by the last time you edited them."
              action={
                <Link
                  to="/people"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong underline-offset-4 hover:underline"
                >
                  View directory
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
            <CardBody>
              {data.recent_people.length === 0 ? (
                <EmptyState
                  icon={ImagePlus}
                  title="No profiles yet"
                  description="Add someone who has agreed to be recognised. You can always add more context later."
                  action={
                    <Link
                      to="/people/new"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add a person
                    </Link>
                  }
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {data.recent_people.map((person) => (
                    <li key={person.id}>
                      <PersonCard person={person} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </section>

        <section aria-labelledby="recent-activity">
          <Card>
            <CardHeader
              id="recent-activity"
              title="Recent activity"
              description="Only confirmed interactions appear here."
              action={
                <Link
                  to="/history"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong underline-offset-4 hover:underline"
                >
                  History
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
            <CardBody>
              {data.recent_interactions.length === 0 ? (
                <div className="py-6 text-center">
                  <Clock className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-ink">No confirmed interactions yet</p>
                  <p className="mt-1 text-sm text-muted">
                    A meeting is recorded only when you confirm it — never because a face was
                    detected.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recent_interactions.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-semibold text-ink">{entry.person_name}</p>
                        <p className="text-sm text-muted">{entry.user_note ?? "No note added"}</p>
                        <p className="mt-1 text-xs text-muted">
                          {formatDateTime(entry.occurred_at)} · {formatRelative(entry.occurred_at)}
                        </p>
                      </div>
                      <Badge tone={entry.event_source === "manual" ? "neutral" : "accent"}>
                        {entry.event_source === "manual" ? "Manual" : "Recognition-assisted"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
}
