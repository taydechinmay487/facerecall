import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Card, CardBody, CardHeader } from "../components/ui/card";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        <CardHeader title={title} />
        <CardBody>
          <div className="space-y-3 text-sm leading-relaxed text-ink-soft">{children}</div>
        </CardBody>
      </Card>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="app-grid py-12">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Trust</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy and your data controls</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          FaceRecall stores face data, which is sensitive biometric information. This page explains in
          plain language what is stored, why it is needed, where it lives, and how you remove it.
          This is a design and engineering description, not legal advice, and no compliance claim is
          made.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        <Section id="what" title="What is stored">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Profile details you typed:</strong> name, relationship, where you met,
              workplace or group, notes, and an optional reminder.
            </li>
            <li>
              <strong>Face representations (embeddings):</strong> a 128-dimension numeric vector per
              enrolment photo, produced by the SFace model. A small preview image (max 320 px) is
              stored when previews are enabled.
            </li>
            <li>
              <strong>Consent record:</strong> a yes/no flag and the timestamp when consent was
              recorded or withdrawn.
            </li>
            <li>
              <strong>Interaction history:</strong> entries you confirmed, plus any note you added.
            </li>
            <li>
              <strong>Your settings:</strong> threshold, margin, frame interval, voice, display and
              retention preferences.
            </li>
          </ul>
          <p>
            Original enrolment photos are <strong>not</strong> stored. They are processed in memory,
            reduced to an embedding and a preview, and then discarded.
          </p>
        </Section>

        <Section id="why" title="Why each item is needed">
          <ul className="list-disc space-y-2 pl-5">
            <li>Embeddings are required to compare a face in view with your enrolled people.</li>
            <li>Context fields are the entire point of the app: they are what you read on a match.</li>
            <li>
              The consent record documents that the person agreed, and drives deletion when they
              withdraw.
            </li>
            <li>Interaction history helps you remember when you last met someone.</li>
            <li>
              Thresholds and margins let you decide how strict recognition must be before a person is
              shown.
            </li>
          </ul>
        </Section>

        <Section id="where" title="Where it is stored, and whether it leaves your machine">
          <p>
            In this prototype everything is stored locally in a SQLite database file inside the
            backend's data directory, and preview images sit beside it. Recognition runs inside the
            local FastAPI process using OpenCV — no cloud service, no third-party face API, and no
            vendor account.
          </p>
          <p>
            The browser sends individual captured frames to that local service over HTTP. If you
            deploy the backend somewhere other than your own computer, frames and embeddings would
            travel over the network to that machine; you would be the operator of that deployment and
            responsible for securing it.
          </p>
        </Section>

        <Section id="retention" title="Retention and deletion">
          <ul className="list-disc space-y-2 pl-5">
            <li>No camera video is recorded and no frame is written to disk, ever.</li>
            <li>Withdrawing consent deletes the person's embeddings and previews immediately.</li>
            <li>
              Deleting a profile removes its embeddings, previews and interaction history; the
              deletion is cascading at the database level with <code>ON DELETE CASCADE</code>.
            </li>
            <li>
              "Delete all profiles and biometric data" in Settings → Privacy removes everything and
              resets settings, requiring you to type a confirmation phrase.
            </li>
            <li>
              Data export produces a JSON file containing the same records, including embeddings in
              base64, so you can port them elsewhere. Keep that file safe.
            </li>
          </ul>
        </Section>

        <Section id="protection" title="How embeddings are protected">
          <p>
            FaceRecall can encrypt embeddings at rest with a Fernet key you provide through the
            <code> FACERECALL_ENCRYPTION_KEY </code> environment variable. When no key is configured,
            embeddings are stored unencrypted and the app says so in Settings and in
            <code> /api/v1/status </code>.
          </p>
          <p>
            We do not claim that embeddings are anonymous, and we do not claim the system is
            "100% secure" or "zero knowledge". A vector derived from a face is still biometric data:
            it can be re-identified in some circumstances. The honest position is that this is a
            local prototype with sensible defaults, optional encryption, restricted CORS, bounded
            uploads, and no biometric data in URLs or logs — and that a production deployment would
            need authentication, encryption at rest and transport, audit logging, and independent
            review.
          </p>
        </Section>

        <Section id="consent" title="Consent">
          <p>
            Enrolment requires an explicit consent confirmation, and the API rejects any profile
            creation or enrolment that omits it. Only enrol people who have agreed to have their face
            data stored for this purpose, and tell them what the app does and how to have their data
            removed. FaceRecall never scrapes social media, never queries public face databases, and
            never attempts to identify strangers.
          </p>
        </Section>

        <Section id="risks" title="Limitations and risks you should know">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              A false match could lead you to greet the wrong person. Always confirm a match before
              relying on it.
            </li>
            <li>
              Accuracy has not been measured on a volunteer dataset. Thresholds ship as uncalibrated
              starting points.
            </li>
            <li>
              This prototype is single-user and local. It has no user accounts, so anyone with access
              to the machine and the app can read the stored data.
            </li>
            <li>
              If you enable a shared API token and expose the service, treat the whole deployment as
              sensitive infrastructure.
            </li>
            <li>
              Legal duties around biometric data (for example consent, purpose limitation, and
              deletion rights) depend on your jurisdiction and use case. This page describes
              engineering behaviour; it is not legal advice and no compliance claim is made.
            </li>
          </ul>
        </Section>

        <Section id="accessibility" title="Accessibility">
          <p>
            FaceRecall is built with semantic landmarks, a keyboard-accessible dialog with focus
            trapping, visible focus indicators, screen-reader labels on every control, status regions
            that announce recognition results, error messages linked to their fields, and an
            optional reduced-motion mode that also respects your operating-system preference. Text
            size can be increased from Settings without layout breakage, and confidence is never
            communicated by colour alone — every state has a written label.
          </p>
          <p>
            Voice output is off by default and must be switched on explicitly. Names are never spoken
            otherwise.
          </p>
        </Section>

        <Section id="controls" title="Your controls">
          <ul className="list-disc space-y-2 pl-5">
            <li>Export everything as JSON from Settings → Privacy.</li>
            <li>Clear interaction history without touching profiles.</li>
            <li>Withdraw consent for one person and delete only their face data.</li>
            <li>Delete all profiles and biometric data with a typed confirmation.</li>
            <li>Disable preview images so new enrolments store none.</li>
          </ul>
          <p>
            <Link to="/settings" className="font-semibold text-accent-strong underline-offset-4 hover:underline">
              Open the data controls
            </Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
