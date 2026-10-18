import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

type Tone = "neutral" | "accent" | "caution" | "danger" | "success";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-muted text-ink-soft",
  accent: "border-accent/30 bg-accent-soft text-accent-strong",
  caution: "border-caution/30 bg-caution-soft text-caution",
  danger: "border-danger/30 bg-danger-soft text-danger",
  success: "border-accent/30 bg-accent-soft text-accent-strong",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
