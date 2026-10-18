import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Logo } from "../components/app/Logo";
import { cn } from "../lib/cn";

const navItems = [
  { to: "/", label: "How it works", end: true },
  { to: "/about", label: "About" },
  { to: "/privacy", label: "Privacy" },
  { to: "/docs", label: "Documentation" },
];

const footerGroups = [
  {
    title: "Product",
    links: [
      { to: "/app", label: "Open FaceRecall" },
      { to: "/docs", label: "Documentation" },
      { to: "/docs#api", label: "API reference" },
    ],
  },
  {
    title: "Trust",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/privacy#accessibility", label: "Accessibility" },
      { to: "/about#disclaimer", label: "Disclaimer" },
    ],
  },
  {
    title: "Project",
    links: [
      { to: "/about", label: "About" },
      { to: "/docs#limitations", label: "Known limitations" },
      { to: "/privacy#controls", label: "Your data controls" },
    ],
  },
];

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#public-main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-line bg-canvas">
        <div className="app-grid flex flex-wrap items-center justify-between gap-3 py-4">
          <Link to="/" aria-label="FaceRecall home" className="rounded-control">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-control px-3 py-2 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-accent-soft text-accent-strong"
                      : "text-ink-soft hover:bg-surface-muted",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/app"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-strong"
          >
            Open FaceRecall
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <nav aria-label="Primary mobile" className="app-grid flex flex-wrap gap-x-4 gap-y-1 pb-3 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "rounded px-1 py-1 text-sm font-medium",
                  isActive ? "text-accent-strong underline" : "text-ink-soft",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="public-main" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-line bg-surface">
        <div className="app-grid grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size="sm" />
            <p className="mt-3 max-w-xs text-sm text-muted">
              Recognize familiar faces. Recall meaningful connections. A consent-based memory aid
              for people with prosopagnosia.
            </p>
          </div>
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="rounded text-sm text-ink-soft underline-offset-4 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-line">
          <div className="app-grid flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted">
            <p>FaceRecall is an assistive prototype, not a medical device or a diagnosis.</p>
            <p>Local-first · No camera footage stored · Enrolment requires consent</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
