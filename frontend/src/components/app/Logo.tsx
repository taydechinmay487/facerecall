import { ScanFace } from "lucide-react";

import { cn } from "../../lib/cn";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          "flex items-center justify-center rounded-[0.75rem] bg-ink text-canvas",
          box,
        )}
      >
        <ScanFace className={icon} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn("font-semibold tracking-tight text-ink", size === "sm" ? "text-base" : "text-lg")}>
          FaceRecall
        </span>
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted">
          Memory assistant
        </span>
      </span>
    </span>
  );
}
