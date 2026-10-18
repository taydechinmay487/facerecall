import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PersonNewPage } from "../PersonNew";
import { testPersonDetail } from "../../test/fixtures";
import { renderWithProviders } from "../../test/utils";

const peopleMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  enroll: vi.fn(),
  removeEnrollment: vi.fn(),
  withdrawConsent: vi.fn(),
}));

vi.mock("../../services/people", () => ({ peopleService: peopleMocks }));
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

describe("PersonNewPage", () => {
  beforeEach(() => {
    peopleMocks.create.mockReset().mockResolvedValue(testPersonDetail);
    peopleMocks.enroll.mockReset().mockResolvedValue({ enrollment: {}, person: testPersonDetail });
  });

  it("requires a name", async () => {
    renderWithProviders(<PersonNewPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /save profile and enrol/i }));

    expect(await screen.findByText(/a name is required/i)).toBeInTheDocument();
    expect(peopleMocks.create).not.toHaveBeenCalled();
  });

  it("blocks saving until consent is confirmed", async () => {
    renderWithProviders(<PersonNewPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name/i), "Maya Rodrigues");
    await user.click(screen.getByRole("button", { name: /save profile and enrol/i }));

    expect(
      await screen.findByText(/confirm that this person has agreed to be enrolled/i),
    ).toBeInTheDocument();
    expect(peopleMocks.create).not.toHaveBeenCalled();
  });

  it("creates the profile with consent and the typed context", async () => {
    renderWithProviders(<PersonNewPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^name/i), "Maya Rodrigues");
    await user.type(screen.getByLabelText(/relationship to you/i), "Neighbour");
    await user.type(screen.getByLabelText(/where you met/i), "Community garden");
    await user.click(screen.getByLabelText(/has agreed to have their face data stored/i));
    await user.click(screen.getByRole("button", { name: /save profile and enrol/i }));

    await waitFor(() => expect(peopleMocks.create).toHaveBeenCalledTimes(1));
    expect(peopleMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Maya Rodrigues",
        relationship: "Neighbour",
        where_met: "Community garden",
        consent_confirmed: true,
      }),
    );
  });

  it("states the photo target and formats honestly", () => {
    renderWithProviders(<PersonNewPage />);
    expect(screen.getByText(/one to three front-facing photos works best in our design/i)).toBeInTheDocument();
    expect(screen.getByText(/not a guarantee that recognition will succeed/i)).toBeInTheDocument();
    expect(screen.getByText(/up to 8 mb each/i)).toBeInTheDocument();
  });
});
