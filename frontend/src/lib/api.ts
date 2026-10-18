import type { ApiErrorBody } from "../types/api";

export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "";

export class ApiError extends Error {
  status: number;
  code: string;
  details: ApiErrorBody["details"];

  constructor(status: number, code: string, message: string, details?: ApiErrorBody["details"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details ?? {};
  }

  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const field of this.details?.fields ?? []) {
      if (!result[field.field]) result[field.field] = field.message;
    }
    return result;
  }
}

function headers(extra?: HeadersInit): HeadersInit {
  const base: Record<string, string> = { Accept: "application/json" };
  if (API_TOKEN) base.Authorization = `Bearer ${API_TOKEN}`;
  return { ...base, ...(extra as Record<string, string> | undefined) };
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: ApiErrorBody };
    if (body?.error) {
      return new ApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.error.details,
      );
    }
  } catch {
    // fall through to a generic message
  }
  return new ApiError(
    response.status,
    "request_failed",
    response.status >= 500
      ? "The FaceRecall service is not responding as expected. Is the backend running?"
      : "That request could not be completed.",
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(
      0,
      "network_error",
      "FaceRecall cannot reach its local service. Make sure the backend is running on port 8000.",
    );
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: "GET", headers: headers(), signal });
  },
  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  },
  patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal,
    });
  },
  del<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, {
      method: "DELETE",
      headers: body === undefined ? headers() : headers({ "Content-Type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  },
  upload<T>(path: string, file: Blob, filename: string, signal?: AbortSignal): Promise<T> {
    const form = new FormData();
    form.append("file", file, filename);
    return request<T>(path, { method: "POST", headers: headers(), body: form, signal });
  },
  async download(path: string): Promise<{ blob: Blob; filename: string }> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, { headers: headers() });
    } catch {
      throw new ApiError(0, "network_error", "FaceRecall cannot reach its local service.");
    }
    if (!response.ok) throw await parseError(response);
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    return {
      blob: await response.blob(),
      filename: match?.[1] ?? "facerecall-export.json",
    };
  },
};

export function absoluteApiUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}
