import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { LandingPage } from "../Landing";
import { renderWithProviders } from "../../test/utils";

vi.mock("../../services/settings", async () => {
  const { testSettings } = await import("../../test/fixtures");
  return {
    settingsService: {
      get: vi.fn(async () => testSettings),
      update: vi.fn(async () => testSettings),
      diagnostics: vi.fn(),
    },
  };
});

describe("LandingPage", () => {
  it("shows the hero headline and both calls to action", () => {
    renderWithProviders(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /remember the person, not just the face/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open facerecall/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /explore how it works/i })).toBeInTheDocument();
  });

  it("explains the three-step flow", () => {
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole("heading", { name: /enrol people/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /recognise familiar faces/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /recall context/i })).toBeInTheDocument();
  });

  it("states limits instead of promising accuracy", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByText(/not a guarantee of accuracy/i)).toBeInTheDocument();
  });
});
