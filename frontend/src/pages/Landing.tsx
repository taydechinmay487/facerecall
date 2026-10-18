import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Lock,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Enrol people",
    description:
      "Add a consenting person with one to three photos, plus the context you want to recall: how you know them, where you met, and a memory cue.",
  },
  {
    icon: ScanFace,
    title: "Recognise familiar faces",
    description:
      "During a camera session, FaceRecall compares the face in view only with the people you enrolled. If it is not confident, it says so.",
  },
  {
    icon: Sparkles,
    title: "Recall context",
    description:
      "When a match is accepted, you see their name, relationship, where you met and your own notes — so the conversation can start with warmth.",
  },
];

const features = [
  {
    icon: Users,
    title: "Personal context, not public data",
    description:
      "Every detail comes from what you typed. Nothing is scraped from social media and no external face database is ever queried.",
  },
  {
    icon: ShieldCheck,
    title: "Uncertainty is a first-class outcome",
    description:
      "You set an acceptance threshold and an optional ambiguity margin. When two people look similarly close, FaceRecall refuses to guess.",
  },
  {
    icon: Lock,
    title: "Privacy-first by design",
    description:
      "Profiles, embeddings and history stay in a local database. Camera frames are processed one at a time and never written to disk.",
  },
];

const previewRows = [
  { label: "Name", value: "Maya Rodrigues" },
  { label: "Relationship", value: "Neighbour" },
  { label: "Where you met", value: "Riverside community garden" },
  { label: "Memory cue", value: "Runs the seed swap · two children" },
  { label: "Last confirmed", value: "9 days ago" },
];

export function LandingPage() {
  return (
    <div>
      <section className="app-grid grid gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />
            Assistive memory tool for prosopagnosia
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
            Remember the person, not just the face.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            FaceRecall helps people with face blindness recognise familiar, consenting people and
            recall the context that matters — without ever pretending to be certain.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/app"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-control bg-accent px-5 py-3 text-base font-semibold text-white transition-colors duration-150 hover:bg-accent-strong"
            >
              Open FaceRecall
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-control border border-line bg-surface px-5 py-3 text-base font-semibold text-ink transition-colors duration-150 hover:bg-surface-muted"
            >
              Explore how it works
            </a>
          </div>
          <p className="mt-6 max-w-lg text-sm text-muted">
            Faces are only enrolled with explicit consent. FaceRecall is not a medical device, not a
            diagnosis, and not a stranger-identification system.
          </p>
        </div>

        <figure className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-surface-muted px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Example match card
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Match accepted
            </span>
          </div>
          <div className="space-y-3 px-5 py-5">
            {previewRows.map((row) => (
              <div key={row.label} className="grid gap-1 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {row.label}
                </p>
                <p className="text-sm text-ink">{row.value}</p>
              </div>
            ))}
            <p className="border-t border-line pt-3 text-xs text-muted">
              Illustration with fictional details. Your own cards show only what you entered.
            </p>
          </div>
        </figure>
      </section>

      <section id="how-it-works" className="border-y border-line bg-surface py-14">
        <div className="app-grid">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How FaceRecall works</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Three deliberate steps, each designed so that a guess never turns into a false memory.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-card border border-line bg-canvas p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="app-grid py-14">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Built for calm, honest recall
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="surface-card p-5">
                <Icon className="h-5 w-5 text-accent-strong" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-surface py-14">
        <div className="app-grid grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Pipeline, stage by stage</h2>
            <p className="mt-3 text-sm text-muted">
              Every stage is a separate module, so a failure to detect a face can never become a
              confident identification.
            </p>
            <ol className="mt-5 space-y-2 text-sm text-ink-soft">
              {[
                "Frame validation (size, format, sharpness, light)",
                "Face detection — YuNet",
                "Alignment and pretrained embedding — SFace",
                "Comparison against your enrolled vectors (cosine similarity)",
                "Threshold plus ambiguity-margin decision",
                "Accepted match or a safe “not confident” outcome",
                "Your context, then optional speech",
                "Your confirmation before anything is recorded",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 rounded-control border border-line bg-canvas px-4 py-2.5">
                  <span className="font-semibold text-accent-strong">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-4">
            <article className="surface-card p-5">
              <h3 className="text-base font-semibold">Privacy and consent</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Only enrol people who have explicitly agreed to have their face data stored for
                this purpose. Withdrawing consent deletes the linked biometric records. Raw
                enrolment photos are discarded after processing; a small preview is kept for the
                directory and can be cleared.
              </p>
              <Link
                to="/privacy"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong underline-offset-4 hover:underline"
              >
                Read the privacy notes
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </article>
            <article className="surface-card p-5">
              <h3 className="text-base font-semibold">Known limitations</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
                <li>Recognition quality depends on lighting, pose and photo quality.</li>
                <li>
                  One to three enrolment photos is a design target to evaluate, not a guarantee of
                  accuracy.
                </li>
                <li>
                  Thresholds shipped as defaults are starting points; calibrate them against your
                  own images.
                </li>
                <li>
                  This prototype is single-user and local. It has no accounts, cloud sync or
                  multi-device support.
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="app-grid py-14">
        <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-xl font-semibold">Ready to try it with your own circle?</h2>
            <p className="mt-1 text-sm text-muted">
              Start with one person who has agreed, or explore the fictional demo first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/app"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Open FaceRecall
            </Link>
            <Link
              to="/docs"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              Read the documentation
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
