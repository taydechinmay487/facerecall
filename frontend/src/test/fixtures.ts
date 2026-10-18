import type {
  AppSettings,
  DashboardSummary,
  InteractionListResponse,
  PersonDetail,
  PersonListResponse,
  PersonSummary,
  RecognitionResult,
  StatusResponse,
} from "../types/api";

export const testSettings: AppSettings = {
  recognition_threshold: 0.45,
  ambiguity_margin: 0.05,
  frame_interval_ms: 300,
  voice_enabled: false,
  speech_rate: 1,
  speech_voice: null,
  text_scale: 1,
  reduce_motion: true,
  retain_thumbnails: true,
  retain_interaction_history: true,
  updated_at: "2026-01-01T10:00:00Z",
};

export const testPerson: PersonSummary = {
  id: 1,
  name: "Maya Rodrigues",
  relationship: "Neighbour",
  where_met: "Riverside community garden",
  organization_or_group: "Garden club",
  notes: "Runs the seed swap.",
  reminder: "Ask about the seedlings.",
  consent_status: true,
  consent_recorded_at: "2026-01-01T10:00:00Z",
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-02T10:00:00Z",
  is_demo: false,
  enrollment_count: 2,
  avatar_url: null,
  last_confirmed_interaction_at: null,
  context_fields_completed: 4,
  context_fields_total: 4,
};

export const testPersonDetail: PersonDetail = {
  ...testPerson,
  enrollments: [
    {
      id: 11,
      person_profile_id: 1,
      model_name: "SFace",
      model_version: "2021dec",
      preprocessing_version: "yunet-2023mar+sface-align-v1",
      embedding_dim: 128,
      quality_score: 0.9,
      has_thumbnail: false,
      created_at: "2026-01-01T10:00:00Z",
      is_demo: false,
    },
  ],
  interaction_count: 1,
};

export const demoPerson: PersonSummary = {
  ...testPerson,
  id: 7,
  name: "Demo Person",
  is_demo: true,
  last_confirmed_interaction_at: "2026-01-05T09:00:00Z",
};

export const personList: PersonListResponse = {
  items: [testPerson],
  total: 1,
  limit: 24,
  offset: 0,
  relationships: ["Neighbour"],
};

export const demoPersonList: PersonListResponse = {
  items: [demoPerson],
  total: 1,
  limit: 24,
  offset: 0,
  relationships: ["Neighbour"],
};

export const emptyPersonList: PersonListResponse = {
  items: [],
  total: 0,
  limit: 24,
  offset: 0,
  relationships: [],
};

export const interactionList: InteractionListResponse = {
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
};

export const statusResponse: StatusResponse = {
  app_version: "0.1.0",
  app_env: "test",
  engine: {
    mode: "real",
    detector_name: "YuNet",
    model_name: "SFace",
    model_version: "2021dec",
    embedding_dim: 128,
    similarity_metric: "cosine",
    models_present: true,
    message: "Real recognition is available.",
  },
  demo_mode_available: true,
  database_backend: "sqlite",
  encryption_enabled: false,
  auth_required: false,
  single_user: true,
  limits: {
    max_upload_bytes: 8000000,
    max_enrollments_per_person: 3,
    accepted_content_types: ["image/jpeg", "image/png", "image/webp"],
  },
  privacy: {
    raw_images_retained: false,
    thumbnails_retained: true,
    camera_video_retained: false,
    processing: "local",
    embeddings_are_biometric: true,
  },
};

export const dashboardSummary: DashboardSummary = {
  total_people: 1,
  people_with_complete_context: 1,
  total_enrollments: 2,
  total_interactions: 0,
  interactions_last_30_days: 0,
  recent_people: [testPerson],
  recent_interactions: [],
  demo_people: 0,
  first_use: false,
};

export const emptyDashboard: DashboardSummary = {
  ...dashboardSummary,
  total_people: 0,
  people_with_complete_context: 0,
  total_enrollments: 0,
  recent_people: [],
  first_use: true,
};

export function recognitionResult(overrides: Partial<RecognitionResult> = {}): RecognitionResult {
  return {
    decision: "accepted_match",
    explanation: "Match accepted: this face met your acceptance threshold.",
    person: {
      id: 1,
      name: "Maya Rodrigues",
      relationship: "Neighbour",
      where_met: "Riverside community garden",
      organization_or_group: "Garden club",
      notes: "Runs the seed swap.",
      reminder: "Ask about the seedlings.",
      avatar_url: null,
      last_confirmed_interaction_at: null,
      enrollment_count: 2,
    },
    diagnostics: {
      threshold: 0.45,
      ambiguity_margin: 0.05,
      best_score: 0.62,
      second_best_score: 0.2,
      best_minus_second: 0.42,
      candidates_considered: 1,
      face_quality: 0.8,
      faces_detected: 1,
    },
    processing_ms: 42,
    model_name: "SFace",
    model_version: "2021dec",
    preprocessing_version: "yunet-2023mar+sface-align-v1",
    mode: "real",
    is_simulated: false,
    guidance: null,
    ...overrides,
  };
}

export const notConfidentResult = recognitionResult({
  decision: "not_confident",
  explanation:
    "Two enrolled people look similarly close to this face, so FaceRecall will not guess. Try again with a clearer, front-facing view.",
  person: null,
  guidance: "Try again with a clearer, front-facing view.",
});

export const unknownResult = recognitionResult({
  decision: "unknown_person",
  explanation: "Not confident enough to identify this person.",
  person: null,
  guidance: "You can enrol more photos of this person.",
});

export const simulatedResult = recognitionResult({
  decision: "accepted_match",
  explanation: "Simulated demo result. This was generated from the demo dataset, not camera analysis.",
  model_name: "demo-synthetic",
  model_version: "0",
  mode: "demo",
  is_simulated: true,
  guidance: "Demo mode is on.",
});
