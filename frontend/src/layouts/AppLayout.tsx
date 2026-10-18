import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  FlaskConical,
  History,
  LayoutDashboard,
  Menu,
  ScanFace,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";

import { DemoBanner } from "../components/app/DemoBanner";
import { Logo } from "../components/app/Logo";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAsync } from "../hooks/useAsync";
import { useDemoMode } from "../hooks/useDemoMode";
import { cn } from "../lib/cn";
import { systemService } from "../services/system";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/recognize", label: "Recognize", icon: ScanFace },
  { to: "/people", label: "People", icon: Users },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-accent-soft text-accent-strong"
                  : "text-ink-soft hover:bg-surface-muted",
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        );
      })}
      <div className="border-t border-line pt-3">
        <Link
          to="/privacy"
          className="flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-muted"
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
          Privacy & data
        </Link>
      </div>
    </nav>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const demo = useDemoMode();
  const { data: status } = useAsync((signal) => systemService.status(signal), []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const engineReady = status?.engine.mode === "real";

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
          <div className="border-b border-line px-5 py-5">
            <Link to="/" aria-label="FaceRecall home" className="rounded-control">
              <Logo size="sm" />
            </Link>
          </div>
          <div className="flex-1 px-3 py-4">
            <Navigation />
          </div>
          <div className="border-t border-line px-4 py-4 text-xs text-muted">
            <p className="font-medium text-ink-soft">Prototype · v{status?.app_version ?? "0.1.0"}</p>
            <p className="mt-1">
              Single-user, local-first. Facial data stays on this machine.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line bg-surface text-ink"
                  aria-label="Open navigation menu"
                  aria-expanded={mobileOpen}
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <Link to="/app" aria-label="FaceRecall dashboard" className="rounded-control">
                  <Logo size="sm" />
                </Link>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                {status ? (
                  engineReady ? (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Real recognition ready
                    </Badge>
                  ) : (
                    <Badge tone="caution">
                      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                      Models not installed — demo only
                    </Badge>
                  )
                ) : (
                  <span className="text-xs text-muted">Checking local service…</span>
                )}
              </div>

              <Button
                variant={demo.enabled ? "secondary" : "ghost"}
                size="sm"
                onClick={() => (demo.enabled ? demo.disable() : void demo.enable())}
                loading={demo.busy}
                aria-pressed={demo.enabled}
                className="ml-auto"
              >
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                {demo.enabled ? "Demo mode on" : "Try demo mode"}
              </Button>
            </div>
          </header>

          <main id="main-content" className="app-grid flex-1 py-6 lg:py-8" tabIndex={-1}>
            {demo.enabled ? (
              <DemoBanner onExit={demo.disable} busy={demo.busy} />
            ) : null}
            {demo.error ? (
              <p role="alert" className="mb-4 text-sm font-medium text-danger">
                {demo.error}
              </p>
            ) : null}
            <Outlet />
          </main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-control text-muted hover:bg-surface-muted"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <Navigation onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
