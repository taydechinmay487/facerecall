import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { App } from "./App";
import { renderWithProviders } from "./test/utils";

vi.mock("./services/system", async () => {
  const { statusResponse: status, dashboardSummary: dashboard, emptyDashboard: empty } =
    await import("./test/fixtures");
  return {
    systemService: {
      status: vi.fn(async () => status),
      dashboard: vi.fn(async () => dashboard),
      exportData: vi.fn(),
      deleteAll: vi.fn(),
      seedDemo: vi.fn(async () => ({ created: 4, already_present: false, message: "" })),
      clearDemo: vi.fn(async () => ({ cleared: 4 })),
    },
  };
});

vi.mock("./services/settings", async () => {
  const { testSettings } = await import("./test/fixtures");
  return {
    settingsService: {
      get: vi.fn(async () => testSettings),
      update: vi.fn(async () => testSettings),
      diagnostics: vi.fn(),
    },
  };
});

vi.mock("./services/people", async () => {
  const { emptyPersonList } = await import("./test/fixtures");
  return {
    peopleService: {
      list: vi.fn(async () => emptyPersonList),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      enroll: vi.fn(),
      removeEnrollment: vi.fn(),
      withdrawConsent: vi.fn(),
    },
  };
});

vi.mock("./services/interactions", async () => {
  const { interactionList } = await import("./test/fixtures");
  return {
    interactionService: {
      list: vi.fn(async () => interactionList),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  };
});

describe("App routes", () => {
  it("renders the public landing page at the root route", () => {
    renderWithProviders(<App />, "/");
    expect(
      screen.getByRole("heading", { name: /remember the person, not just the face/i }),
    ).toBeInTheDocument();
  });

  it("renders the dashboard with main navigation", async () => {
    renderWithProviders(<App />, "/app");

    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    for (const label of ["Dashboard", "Recognize", "People", "History", "Settings"]) {
      expect(nav.textContent).toContain(label);
    }
  });

  it("renders the people page at /people", async () => {
    renderWithProviders(<App />, "/people");
    expect(await screen.findByRole("heading", { name: /your enrolled people/i })).toBeInTheDocument();
  });

  it("renders a not-found page for unknown routes", () => {
    renderWithProviders(<App />, "/does-not-exist");
    expect(screen.getByRole("heading", { name: /that page does not exist/i })).toBeInTheDocument();
  });
});
