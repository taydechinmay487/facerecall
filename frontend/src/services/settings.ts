import { api } from "../lib/api";
import type { AppSettings, DiagnosticsResponse, SettingsPatch } from "../types/api";

export const settingsService = {
  get(signal?: AbortSignal): Promise<AppSettings> {
    return api.get<AppSettings>("/api/v1/settings", signal);
  },
  update(patch: SettingsPatch): Promise<AppSettings> {
    return api.patch<AppSettings>("/api/v1/settings", patch);
  },
  diagnostics(signal?: AbortSignal): Promise<DiagnosticsResponse> {
    return api.get<DiagnosticsResponse>("/api/v1/settings/diagnostics", signal);
  },
};
