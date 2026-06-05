// Database row types (mirror the Supabase schema).
// Hand-written instead of generated for hackathon speed.

export interface UserRow {
  id: string;
  upn: string;
  display_name: string;
  job_title: string | null;
  department: string | null;
  is_privileged: boolean;
  privileged_role: string | null;
  usual_country: string | null;
  usual_city: string | null;
  usual_device_os: string | null;
  usual_hours_start: number | null;
  usual_hours_end: number | null;
  created_at: string;
}

export interface SignInRow {
  id: string;
  graph_id: string;
  user_id: string;
  created_at_event: string;
  is_interactive: boolean;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  is_tor_or_anon: boolean;
  client_app: string | null;
  device_os: string | null;
  device_browser: string | null;
  is_compliant_device: boolean | null;
  is_managed_device: boolean | null;
  mfa_detail: string | null;
  conditional_access_status: string | null;
  risk_level_aggregated: string | null;
  risk_state: string | null;
  resource_display_name: string | null;
  application_display_name: string | null;
  status_code: number | null;
  status_failure_reason: string | null;
  raw_json: Record<string, unknown>;
  ingested_at: string;
}

export interface InvestigationRow {
  id: string;
  sign_in_id: string;
  risk_score: number;
  verdict: "benign" | "suspicious" | "malicious";
  summary: string;
  reasoning: string;
  signals: SignalCitation[];
  citations: PersistedCitation[];
  phase_timings: PersistedPhaseTiming[];
  knowledge_source: "foundry-iq" | "bundled-fallback" | null;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  cached: boolean;
  created_at: string;
}

export interface PersistedCitation {
  source_id: string;
  title: string;
  publisher: string;
  url: string;
  snippet: string;
  score: number;
  why?: string;       // populated when the model explicitly cited it
}

export interface PersistedPhaseTiming {
  phase:
    | "heuristic_signals"
    | "knowledge_retrieval"
    | "llm_reasoning"
    | "action_synthesis";
  started_at: string;
  duration_ms: number;
  detail?: string;
}

export type ActionType =
  | "force_password_reset"
  | "require_mfa"
  | "disable_account"
  | "revoke_sessions"
  | "review_privileged_activity"
  | "notify_user"
  | "no_action";

export type Severity = "low" | "medium" | "high" | "critical";

export interface RecommendedActionRow {
  id: string;
  investigation_id: string;
  action_type: ActionType;
  rationale: string;
  severity: Severity;
  order_index: number;
  created_at: string;
}

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "failed";

export interface ApprovalRow {
  id: string;
  action_id: string;
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
  created_at: string;
}

export type ActorKind = "agent" | "human" | "system";

export interface AuditLogRow {
  id: string;
  actor: string;
  actor_kind: ActorKind;
  event_type: string;
  subject_kind: string | null;
  subject_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface SignalCitation {
  name: string;
  value: string;
  weight: "low" | "medium" | "high";
}
