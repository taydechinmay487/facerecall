import { api } from "../lib/api";
import type { InteractionInput, InteractionListResponse, InteractionRead } from "../types/api";

export interface InteractionQuery {
  person_id?: number;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export const interactionService = {
  list(query: InteractionQuery = {}, signal?: AbortSignal): Promise<InteractionListResponse> {
    const params = new URLSearchParams();
    if (query.person_id) params.set("person_id", String(query.person_id));
    if (query.start) params.set("start", query.start);
    if (query.end) params.set("end", query.end);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.offset) params.set("offset", String(query.offset));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return api.get<InteractionListResponse>(`/api/v1/interactions${suffix}`, signal);
  },

  create(payload: InteractionInput): Promise<InteractionRead> {
    return api.post<InteractionRead>("/api/v1/interactions", payload);
  },

  update(
    id: number,
    payload: { user_note?: string | null; occurred_at?: string; confirmation_status?: string },
  ): Promise<InteractionRead> {
    return api.patch<InteractionRead>(`/api/v1/interactions/${id}`, payload);
  },

  remove(id: number): Promise<{ deleted: boolean }> {
    return api.del<{ deleted: boolean }>(`/api/v1/interactions/${id}`);
  },

  clear(personId?: number): Promise<{ deleted: number }> {
    const suffix = personId ? `?person_id=${personId}` : "";
    return api.del<{ deleted: number }>(`/api/v1/interactions${suffix}`);
  },
};
