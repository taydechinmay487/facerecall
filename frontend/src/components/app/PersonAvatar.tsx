import { useState } from "react";

import { absoluteApiUrl } from "../../lib/api";
import { cn } from "../../lib/cn";
import { initials } from "../../lib/format";

export function PersonAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const src = absoluteApiUrl(avatarUrl);
  const dimensions =
    size === "sm" ? "h-10 w-10 text-sm" : size === "lg" ? "h-20 w-20 text-xl" : "h-12 w-12 text-base";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`Enrolment photo of ${name}`}
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full border border-line object-cover", dimensions)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-muted font-semibold text-ink-soft",
        dimensions,
      )}
    >
      {initials(name)}
    </span>
  );
}
