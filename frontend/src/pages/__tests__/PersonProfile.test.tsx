import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { PersonProfilePage } from "../PersonProfile";
import { ToastProvider } from "../../components/ui/toast";
import { DemoModeProvider } from "../../hooks/useDemoMode";
import { SettingsProvider } from "../../hooks/useSettings";
import { interactionList, testPersonDetail } from "../../test/fixtures";

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

const interactionMocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("../../services/people", () => ({ peopleService: peopleMocks }));
vi.mock("../../services/interactions", () => ({ interactionService: interactionMocks }));
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

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/people/1"]}>
      <ToastProvider>
        <SettingsProvider>
          <DemoModeProvider>
            <Routes>
              <Route path="/people/:id" element={<PersonProfilePage />} />
            </Routes>
          </DemoModeProvider>
        </SettingsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("PersonProfilePage", () => {
  beforeEach(() => {
    peopleMocks.get.mockReset().mockResolvedValue(testPersonDetail);
    peopleMocks.remove.mockReset().mockResolvedValue({ deleted: true });
    peopleMocks.withdrawConsent.mockReset().mockResolvedValue({
      consent_status: false,
      enrollments_deleted: 1,
      message: "Consent withdrawn.",
    });
    interactionMocks.list.mockReset().mockResolvedValue(interactionList);
  });

  it("shows context and never invents a last-met date", async () => {
    renderProfile();

    expect(await screen.findByRole("heading", { name: "Maya Rodrigues" })).toBeInTheDocument();
    expect(screen.getByText(/riverside community garden/i)).toBeInTheDocument();
    expect(screen.getByText(/not recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/never guesses a last-met date/i)).toBeInTheDocument();
  });

  it("asks for confirmation before deleting a profile", async () => {
    renderProfile();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /delete profile/i }));
    expect(await screen.findByRole("dialog", { name: /delete maya rodrigues/i })).toBeInTheDocument();
    expect(peopleMocks.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /delete permanently/i }));
    await waitFor(() => expect(peopleMocks.remove).toHaveBeenCalledWith(1));
  });

  it("confirms consent withdrawal separately from deletion", async () => {
    renderProfile();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: /withdraw consent and delete face data/i }),
    );
    expect(await screen.findByRole("dialog", { name: /withdraw consent for maya rodrigues/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^withdraw consent$/i }));
    await waitFor(() => expect(peopleMocks.withdrawConsent).toHaveBeenCalledWith(1));
  });

  it("labels stored enrolments with model and dimension metadata", async () => {
    renderProfile();
    expect(await screen.findByText(/SFace 2021dec · 128-D/)).toBeInTheDocument();
    expect(screen.getByText(/consent recorded/i)).toBeInTheDocument();
  });
});
