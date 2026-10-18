import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useCamera } from "../useCamera";

function stubStream() {
  const track = { stop: vi.fn(), getSettings: () => ({ deviceId: "cam-1" }) };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
  return { stream: stream as unknown as MediaStream, track };
}

const originalMediaDevices = navigator.mediaDevices;

function mockMediaDevices(getUserMedia: () => Promise<MediaStream>, devices: MediaDeviceInfo[] = []) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: async () => devices,
    },
  });
}

describe("useCamera", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("reports a blocked permission with guidance", async () => {
    mockMediaDevices(() =>
      Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" })),
    );
    const { result } = renderHook(() => useCamera());

    let ok = true;
    await act(async () => {
      ok = await result.current.start();
    });

    expect(ok).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.issue?.code).toBe("denied");
    expect(result.current.issue?.help).toMatch(/site settings/i);
  });

  it("times out instead of hanging forever when the browser never answers", async () => {
    mockMediaDevices(() => new Promise<MediaStream>(() => undefined));
    const { result } = renderHook(() => useCamera());

    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = result.current.start();
      await vi.advanceTimersByTimeAsync(20_100);
    });

    const ok = await pending;
    expect(ok).toBe(false);
    expect(result.current.issue?.code).toBe("unknown");
    expect(result.current.status).toBe("error");
  });

  it("becomes ready and lists devices once permission is granted", async () => {
    const { stream, track } = stubStream();
    mockMediaDevices(async () => stream, [
      { deviceId: "cam-1", kind: "videoinput", label: "Camera 1" } as MediaDeviceInfo,
      { deviceId: "mic-1", kind: "audioinput", label: "Mic" } as MediaDeviceInfo,
    ]);
    const { result } = renderHook(() => useCamera());

    let ok = false;
    await act(async () => {
      ok = await result.current.start();
    });

    expect(ok).toBe(true);
    expect(result.current.status).toBe("ready");
    expect(result.current.deviceId).toBe("cam-1");
    expect(result.current.devices).toHaveLength(1);

    act(() => result.current.stop());
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });
});
