import { api } from "../lib/api";
import type {
  DashboardSummary,
  StatusResponse,
} from "../types/api";

export const systemService = {
  status(signal?: AbortSignal): Promise<StatusResponse> {
    return api.get<StatusResponse>("/api/v1/status", signal);
  },
  dashboard(signal?: AbortSignal): Promise<DashboardSummary> {
    return api.get<DashboardSummary>("/api/v1/dashboard", signal);
  },
  exportData(): Promise<{ blob: Blob; filename: string }> {
    return api.download("/api/v1/export");
  },
  deleteAll(
    confirmText: string,
    includeDemo = false,
  ): Promise<{
    deleted_people: number;
    deleted_interactions: number;
    deleted_enrollments: number;
    deleted_files: number;
    message: string;
  }> {
    return api.del("/api/v1/data", { confirm_text: confirmText, include_demo: includeDemo });
  },
  seedDemo(): Promise<{ created: number; already_present: boolean; message: string }> {
    return api.post("/api/v1/demo/seed", {});
  },
  clearDemo(): Promise<{ cleared: number }> {
    return api.del("/api/v1/demo");
  },
};
