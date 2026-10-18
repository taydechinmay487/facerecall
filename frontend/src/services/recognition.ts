import { api } from "../lib/api";
import type { RecognitionResult } from "../types/api";

export const recognitionService = {
  match(frame: Blob, signal?: AbortSignal): Promise<RecognitionResult> {
    return api.upload<RecognitionResult>("/api/v1/recognition/match", frame, "frame.jpg", signal);
  },

  demoMatch(signal?: AbortSignal): Promise<RecognitionResult> {
    return api.post<RecognitionResult>("/api/v1/recognition/demo", undefined, signal);
  },
};
