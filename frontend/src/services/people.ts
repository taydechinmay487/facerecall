import { api } from "../lib/api";
import type {
  EnrollmentSummary,
  PersonDetail,
  PersonInput,
  PersonListResponse,
  PersonUpdateInput,
} from "../types/api";

export interface PeopleQuery {
  q?: string;
  relationship?: string;
  sort?: "name" | "recent";
  dataset?: "real" | "demo";
  limit?: number;
  offset?: number;
}

export const peopleService = {
  list(query: PeopleQuery = {}, signal?: AbortSignal): Promise<PersonListResponse> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.relationship) params.set("relationship", query.relationship);
    if (query.sort) params.set("sort", query.sort);
    if (query.dataset) params.set("dataset", query.dataset);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.offset) params.set("offset", String(query.offset));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return api.get<PersonListResponse>(`/api/v1/people${suffix}`, signal);
  },

  get(id: number, signal?: AbortSignal): Promise<PersonDetail> {
    return api.get<PersonDetail>(`/api/v1/people/${id}`, signal);
  },

  create(payload: PersonInput): Promise<PersonDetail> {
    return api.post<PersonDetail>("/api/v1/people", payload);
  },

  update(id: number, payload: PersonUpdateInput): Promise<PersonDetail> {
    return api.patch<PersonDetail>(`/api/v1/people/${id}`, payload);
  },

  remove(id: number): Promise<{ deleted: boolean }> {
    return api.del<{ deleted: boolean }>(`/api/v1/people/${id}`);
  },

  enroll(
    id: number,
    file: File | Blob,
    filename = "enrollment.jpg",
  ): Promise<{ enrollment: EnrollmentSummary; person: PersonDetail }> {
    return api.upload(`/api/v1/people/${id}/enroll`, file, filename);
  },

  removeEnrollment(id: number, enrollmentId: number): Promise<{ deleted: boolean }> {
    return api.del<{ deleted: boolean }>(`/api/v1/people/${id}/enrollments/${enrollmentId}`);
  },

  withdrawConsent(
    id: number,
  ): Promise<{ consent_status: boolean; enrollments_deleted: number; message: string }> {
    return api.post(`/api/v1/people/${id}/consent/withdraw`);
  },
};
