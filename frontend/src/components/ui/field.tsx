import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

const controlClasses =
  "w-full rounded-control border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/70 " +
  "focus-visible:border-accent disabled:bg-surface-muted";

function Frame({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required ? (
          <>
            {" "}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
            <span className="visually-hidden"> (required)</span>
          </>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
        )}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

interface SharedProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function TextField({
  id,
  label,
  hint,
  error,
  required,
  className,
  ...props
}: SharedProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={id}
        className={cn(controlClasses, error && "border-danger")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...props}
      />
    </Frame>
  );
}

export function TextareaField({
  id,
  label,
  hint,
  error,
  required,
  className,
  rows = 4,
  ...props
}: SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={id}
        rows={rows}
        className={cn(controlClasses, "resize-y", error && "border-danger")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...props}
      />
    </Frame>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: SharedProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={id}
        className={cn(controlClasses, "pr-8", error && "border-danger")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {children}
      </select>
    </Frame>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-danger">
      {children}
    </p>
  );
}
