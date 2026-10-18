import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RecognizePage } from "../Recognize";
import { notConfidentResult, recognitionResult, simulatedResult } from "../../test/fixtures";
import { renderWithProviders } from "../../test/utils";

const camera = vi.hoisted(() => ({
  status: "idle" as "idle" | "requesting" | "ready" | "error",
  issue: null as null | { code: string; message: string; help: string },
  start: vi.fn(),
  stop: vi.fn(),
  captureFrame: vi.fn(),
}));

const recognition = vi.hoisted(() => ({ match: vi.fn(), demoMatch: vi.fn() }));
const interactions = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), update: vi.fn(), remove: vi.fn(), clear: vi.fn() }));

vi.mock("../../hooks/useCamera", () => ({
  useCamera: () => ({
    videoRef: { current: null },
    status: camera.status,
    issue: camera.issue,
    devices: [],
    deviceId: "",
    start: camera.start,
    stop: camera.stop,
    captureFrame: camera.captureFrame,
  }),
}));

vi.mock("../../services/recognition", () => ({ recognitionService: recognition }));
vi.mock("../../services/interactions", () => ({ interactionService: interactions }));

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

describe("RecognizePage", () => {
  beforeEach(() => {
    camera.status = "idle";
    camera.issue = null;
    camera.start.mockReset().mockResolvedValue(true);
    camera.stop.mockReset();
    camera.captureFrame.mockReset().mockResolvedValue(new Blob(["frame"], { type: "image/jpeg" }));
    recognition.match.mockReset().mockResolvedValue(recognitionResult());
    recognition.demoMatch.mockReset().mockResolvedValue(simulatedResult);
    interactions.create.mockReset().mockResolvedValue({ id: 1 });
    window.sessionStorage.clear();
  });

  it("keeps the camera off until the user presses start", async () => {
    renderWithProviders(<RecognizePage />);

    expect(screen.getByRole("button", { name: /start camera/i })).toBeInTheDocument();
    expect(camera.start).not.toHaveBeenCalled();
    expect(recognition.match).not.toHaveBeenCalled();
  });

  it("explains a denied camera permission with a retry", async () => {
    camera.issue = {
      code: "denied",
      message: "Camera permission was blocked.",
      help: "Open your browser's site settings for this page, allow camera access, then press Start camera again.",
    };
    camera.status = "error";

    renderWithProviders(<RecognizePage />);

    expect(screen.getByText(/camera permission was blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/allow camera access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry camera/i })).toBeInTheDocument();
  });

  it("shows an accepted match with context, and never a certainty percentage", async () => {
    renderWithProviders(<RecognizePage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /start camera/i }));

    expect(await screen.findByText("Maya Rodrigues", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText("Neighbour")).toBeInTheDocument();
    expect(screen.getByText(/riverside community garden/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /correct match/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /not this person/i })).toBeInTheDocument();
    // Qualitative wording only: the raw similarity score is never rendered.
    expect(screen.queryByText("0.62")).not.toBeInTheDocument();
    expect(screen.getAllByText(/match accepted/i).length).toBeGreaterThan(0);
  });

  it("reports an uncertain match safely", async () => {
    recognition.match.mockResolvedValue(notConfidentResult);
    renderWithProviders(<RecognizePage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /start camera/i }));

    expect(
      await screen.findByText(/not confident enough to identify/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /correct match/i })).not.toBeInTheDocument();
  });

  it("records an interaction only after the user confirms", async () => {
    renderWithProviders(<RecognizePage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /start camera/i }));
    await screen.findByText("Maya Rodrigues", {}, { timeout: 4000 });

    expect(interactions.create).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /correct match/i }));
    await user.click(screen.getByRole("button", { name: /save interaction/i }));

    await waitFor(() => expect(interactions.create).toHaveBeenCalledTimes(1));
    expect(interactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ person_profile_id: 1, event_source: "recognition_assisted" }),
    );
  });

  it("labels demo mode as simulated and does not use the camera", async () => {
    window.sessionStorage.setItem("facerecall:demo-mode", "1");
    renderWithProviders(<RecognizePage />);

    expect(screen.getByText(/demo mode: simulated results/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start camera/i })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /show a simulated match/i }));

    expect(await screen.findByText("Maya Rodrigues")).toBeInTheDocument();
    expect(screen.getByText(/simulated demo match/i)).toBeInTheDocument();
    expect(recognition.match).not.toHaveBeenCalled();
  });
});
