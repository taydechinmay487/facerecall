import { Check } from "lucide-react";

import { cn } from "../../lib/cn";

export function Switch({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="block cursor-pointer text-sm font-semibold text-ink">
          {label}
        </label>
        {description ? (
          <p id={`${id}-desc`} className="mt-1 max-w-xl text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150",
          checked ? "border-accent bg-accent" : "border-line bg-surface-muted",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        >
          {checked ? <Check className="h-3 w-3 text-accent-strong" aria-hidden="true" /> : null}
        </span>
        <span className="visually-hidden">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
