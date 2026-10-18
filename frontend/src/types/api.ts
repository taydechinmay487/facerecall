export type Decision =
  | "accepted_match"
  | "unknown_person"
  | "not_confident"
  | "no_face_detected"
  | "multiple_faces_detected"
  | "processing_error";

export interface PersonSummary {
  id: number;
  name: string;
  relationship: string | null;
  where_met: string | null;
  organization_or_group: string | null;
  notes: string | null;
  reminder: string | null;
  consent_status: boolean;
  consent_recorded_at: string | null;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
  enrollment_count: number;
  avatar_url: string | null;
  last_confirmed_interaction_at: string | null;
  context_fields_completed: number;
  context_fields_total: number;
}

export interface EnrollmentSummary {
  id: number;
  person_profile_id: number;
  model_name: string;
  model_version: string;
  preprocessing_version: string;
  embedding_dim: number;
  quality_score: number | null;
  has_thumbnail: boolean;
  created_at: string;
  is_demo: boolean;
}

export interface PersonDetail extends PersonSummary {
  enrollments: EnrollmentSummary[];
  interaction_count: number;
}

export interface PersonListResponse {
  items: PersonSummary[];
  total: number;
  limit: number;
  offset: number;
  relationships: string[];
}

export interface PersonInput {
  name: string;
  relationship?: string | null;
  where_met?: string | null;
  organization_or_group?: string | null;
  notes?: string | null;
  reminder?: string | null;
  consent_confirmed: boolean;
}

export type PersonUpdateInput = Partial<Omit<PersonInput, "consent_confirmed">>;

export interface InteractionRead {
  id: number;
  person_profile_id: number;
  person_name: string;
  occurred_at: string;
  event_source: "manual" | "recognition_assisted";
  confirmation_status: "confirmed" | "corrected";
  user_note: string | null;
  created_at: string;
}

export interface InteractionListResponse {
  items: InteractionRead[];
  total: number;
  limit: number;
  offset: number;
}

export interface InteractionInput {
  person_profile_id: number;
  occurred_at?: string;
  event_source?: "manual" | "recognition_assisted";
  confirmation_status?: "confirmed" | "corrected";
  user_note?: string | null;
}

export interface AppSettings {
  recognition_threshold: number;
  ambiguity_margin: number;
  frame_interval_ms: number;
  voice_enabled: boolean;
  speech_rate: number;
  speech_voice: string | null;
  text_scale: number;
  reduce_motion: boolean;
  retain_thumbnails: boolean;
  retain_interaction_history: boolean;
  updated_at: string;
}

export type SettingsPatch = Partial<Omit<AppSettings, "updated_at">>;

export interface PersonContext {
  id: number;
  name: string;
  relationship: string | null;
  where_met: string | null;
  organization_or_group: string | null;
  notes: string | null;
  reminder: string | null;
  avatar_url: string | null;
  last_confirmed_interaction_at: string | null;
  enrollment_count: number;
}

export interface RecognitionDiagnostics {
  threshold: number;
  ambiguity_margin: number;
  best_score: number | null;
  second_best_score: number | null;
  best_minus_second: number | null;
  candidates_considered: number;
  face_quality: number | null;
  faces_detected: number;
}

export interface RecognitionResult {
  decision: Decision;
  explanation: string;
  person: PersonContext | null;
  diagnostics: RecognitionDiagnostics;
  processing_ms: number;
  model_name: string;
  model_version: string;
  preprocessing_version: string;
  mode: "real" | "demo";
  is_simulated: boolean;
  guidance: string | null;
}

export interface EngineStatus {
  mode: "real" | "unavailable";
  detector_name: string;
  model_name: string;
  model_version: string;
  embedding_dim: number | null;
  similarity_metric: string;
  models_present: boolean;
  message: string;
}

export interface StatusResponse {
  app_version: string;
  app_env: string;
  engine: EngineStatus;
  demo_mode_available: boolean;
  database_backend: string;
  encryption_enabled: boolean;
  auth_required: boolean;
  single_user: boolean;
  limits: {
    max_upload_bytes: number;
    max_enrollments_per_person: number;
    accepted_content_types: string[];
  };
  privacy: {
    raw_images_retained: boolean;
    thumbnails_retained: boolean;
    camera_video_retained: boolean;
    processing: string;
    embeddings_are_biometric: boolean;
  };
}

export interface DashboardSummary {
  total_people: number;
  people_with_complete_context: number;
  total_enrollments: number;
  total_interactions: number;
  interactions_last_30_days: number;
  recent_people: PersonSummary[];
  recent_interactions: InteractionRead[];
  demo_people: number;
  first_use: boolean;
}

export interface DiagnosticsResponse {
  engine: EngineStatus;
  thresholds: {
    recognition_threshold: number;
    ambiguity_margin: number;
    frame_interval_ms: number;
  };
  note: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: {
    fields?: { field: string; message: string }[];
    [key: string]: unknown;
  };
}
