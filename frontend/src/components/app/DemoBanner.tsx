import { FlaskConical } from "lucide-react";

import { Button } from "../ui/button";

export function DemoBanner({ onExit, busy }: { onExit: () => void; busy?: boolean }) {
  return (
    <div
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-caution/40 bg-caution-soft px-4 py-3"
      role="region"
      aria-label="Demo mode notice"
    >
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-caution" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-caution">Demo mode is on</p>
          <p className="text-sm text-ink-soft">
            You are looking at fictional profiles. Recognition results are simulated and never come
            from the camera model.
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onExit} loading={busy}>
        Exit demo mode
      </Button>
    </div>
  );
}
