import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { PeoplePage } from "../People";
import { emptyPersonList, demoPersonList, personList } from "../../test/fixtures";
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

describe("PeoplePage", () => {
  beforeEach(() => {
    peopleMocks.list.mockReset();
    window.sessionStorage.clear();
  });

  it("lists profiles returned by the API", async () => {
    peopleMocks.list.mockResolvedValue(personList);
    renderWithProviders(<PeoplePage />);

    expect(await screen.findByText("Maya Rodrigues")).toBeInTheDocument();
    expect(screen.getByText(/1 profile/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/relationship/i)).toBeInTheDocument();
  });

  it("shows a helpful empty state when nothing is enrolled", async () => {
    peopleMocks.list.mockResolvedValue(emptyPersonList);
    renderWithProviders(<PeoplePage />);

    expect(await screen.findByRole("heading", { name: /no profiles yet/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add your first person/i })).toBeInTheDocument();
  });

  it("labels demo profiles and keeps them read-only", async () => {
    window.sessionStorage.setItem("facerecall:demo-mode", "1");
    peopleMocks.list.mockResolvedValue(demoPersonList);
    renderWithProviders(<PeoplePage />);

    expect(await screen.findByText("Demo Person")).toBeInTheDocument();
    expect(screen.getByText(/fictional demo dataset/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /demo person/i })).not.toBeInTheDocument();
  });

  it("surfaces a recoverable error state with a retry", async () => {
    peopleMocks.list.mockRejectedValue(new Error("FaceRecall cannot reach its local service."));
    renderWithProviders(<PeoplePage />);

    expect(await screen.findByRole("heading", { name: /directory unavailable/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("passes search input through to the API", async () => {
    peopleMocks.list.mockResolvedValue(personList);
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);

    await screen.findByText("Maya Rodrigues");
    await user.type(screen.getByLabelText(/^search/i), "zara");

    await waitFor(() =>
      expect(peopleMocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "zara" }),
        expect.anything(),
      ),
    );
  });
});
