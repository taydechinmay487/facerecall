import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";
export type CameraErrorCode =
  | "denied"
  | "not_found"
  | "in_use"
  | "insecure"
  | "unsupported"
  | "unknown";

export interface CameraIssue {
  code: CameraErrorCode;
  message: string;
  help: string;
}

const ISSUES: Record<CameraErrorCode, { message: string; help: string }> = {
  denied: {
    message: "Camera permission was blocked.",
    help: "Open your browser's site settings for this page, allow camera access, then press Start camera again.",
  },
  not_found: {
    message: "No camera was found.",
    help: "Connect a webcam, or check that no privacy switch or cover is disabling it.",
  },
  in_use: {
    message: "The camera is busy.",
    help: "Another application may be using it. Close that app and try again.",
  },
  insecure: {
    message: "Camera access needs a secure connection.",
    help: "Open FaceRecall at http://localhost:5173 or over HTTPS. Browsers block cameras on plain HTTP for other hosts.",
  },
  unsupported: {
    message: "This browser does not expose a camera API.",
    help: "Try a recent version of Chrome, Edge, Firefox or Safari.",
  },
  unknown: {
    message: "The camera did not respond.",
    help: "The browser never answered the permission request. Check that a camera is connected and that this page is allowed to use it, then press Retry camera.",
  },
};

function toIssue(code: CameraErrorCode): CameraIssue {
  return { code, ...ISSUES[code] };
}

function mapError(error: unknown): CameraIssue {
  const name = (error as { name?: string })?.name ?? "";
  if (name === "TimeoutError") return toIssue("unknown");
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return toIssue("denied");
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return toIssue("not_found");
  if (name === "NotReadableError" || name === "TrackStartError") return toIssue("in_use");
  if (name === "SecurityError") return toIssue("insecure");
  return toIssue("unknown");
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [issue, setIssue] = useState<CameraIssue | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setStatus("idle");
    setIssue(null);
  }, [release]);

  const start = useCallback(
    async (requestedDeviceId?: string) => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setIssue(toIssue("unsupported"));
        return false;
      }
      setStatus("requesting");
      setIssue(null);
      // Some environments never answer the permission request (no device, a
      // suppressed prompt, or a hung browser). Fail loudly instead of leaving the
      // user staring at "requesting" forever.
      let timer: number | undefined;
      let request: Promise<MediaStream> | undefined;
      try {
        request = navigator.mediaDevices.getUserMedia({
          audio: false,
          video: requestedDeviceId
            ? {
                deviceId: { exact: requestedDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        });
        const stream = await Promise.race([
          request,
          new Promise<never>((_, reject) => {
            timer = window.setTimeout(
              () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })),
              20_000,
            );
          }),
        ]).finally(() => window.clearTimeout(timer));
        release();
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          try {
            await video.play();
          } catch {
            // Autoplay can be deferred by the browser; the stream is still live.
          }
        }
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.();
        setDeviceId(settings?.deviceId ?? requestedDeviceId ?? "");
        if (navigator.mediaDevices.enumerateDevices) {
          const all = await navigator.mediaDevices.enumerateDevices();
          setDevices(all.filter((device) => device.kind === "videoinput"));
        }
        setStatus("ready");
        return true;
      } catch (error) {
        // If the request resolves after our timeout, make sure we do not leave the
        // physical camera light on.
        request
          ?.then((late) => late.getTracks().forEach((track) => track.stop()))
          .catch(() => undefined);
        setStatus("error");
        setIssue(mapError(error));
        return false;
      }
    },
    [release],
  );

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    const width = Math.min(720, video.videoWidth);
    const height = Math.round((video.videoHeight / video.videoWidth) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { videoRef, status, issue, devices, deviceId, start, stop, captureFrame };
}
