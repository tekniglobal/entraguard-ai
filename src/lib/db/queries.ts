import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActorKind,
  ApprovalRow,
  ApprovalStatus,
  AuditLogRow,
  InvestigationRow,
  RecommendedActionRow,
  SignInRow,
  UserRow,
} from "@/lib/db/types";

// ====== Sign-ins ======
export async function listSignIns(supabase: SupabaseClient): Promise<
  Array<SignInRow & { user: UserRow }>
> {
  const { data, error } = await supabase
    .from("sign_ins")
    .select("*, user:users(*)")
    .order("created_at_event", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<SignInRow & { user: UserRow }>;
}

export async function getSignIn(
  supabase: SupabaseClient,
  id: string
): Promise<(SignInRow & { user: UserRow }) | null> {
  const { data, error } = await supabase
    .from("sign_ins")
    .select("*, user:users(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as (SignInRow & { user: UserRow }) | null;
}

export async function getSignInHistory(
  supabase: SupabaseClient,
  userId: string,
  excludeId?: string
): Promise<SignInRow[]> {
  let q = supabase
    .from("sign_ins")
    .select("*")
    .eq("user_id", userId)
    .order("created_at_event", { ascending: false })
    .limit(50);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SignInRow[];
}

// ====== Investigations ======
export async function getInvestigationBySignIn(
  supabase: SupabaseClient,
  signInId: string
): Promise<InvestigationRow | null> {
  const { data, error } = await supabase
    .from("investigations")
    .select("*")
    .eq("sign_in_id", signInId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as InvestigationRow | null;
}

export async function getInvestigation(
  supabase: SupabaseClient,
  id: string
): Promise<InvestigationRow | null> {
  const { data, error } = await supabase
    .from("investigations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as InvestigationRow | null;
}

export async function listInvestigations(
  supabase: SupabaseClient
): Promise<
  Array<
    InvestigationRow & {
      sign_in: SignInRow & { user: UserRow };
    }
  >
> {
  const { data, error } = await supabase
    .from("investigations")
    .select("*, sign_in:sign_ins(*, user:users(*))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Array<
    InvestigationRow & { sign_in: SignInRow & { user: UserRow } }
  >;
}

export async function getActionsForInvestigation(
  supabase: SupabaseClient,
  investigationId: string
): Promise<Array<RecommendedActionRow & { approval: ApprovalRow | null }>> {
  const { data, error } = await supabase
    .from("recommended_actions")
    .select("*, approval:approvals(*)")
    .eq("investigation_id", investigationId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    approval: Array.isArray(row.approval) ? row.approval[0] ?? null : row.approval,
  }));
}

// ====== Approvals ======
export async function listPendingApprovals(supabase: SupabaseClient): Promise<
  Array<
    ApprovalRow & {
      action: RecommendedActionRow & {
        investigation: InvestigationRow & {
          sign_in: SignInRow & { user: UserRow };
        };
      };
    }
  >
> {
  const { data, error } = await supabase
    .from("approvals")
    .select(
      "*, action:recommended_actions(*, investigation:investigations(*, sign_in:sign_ins(*, user:users(*))))"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as any;
}

export async function setApprovalDecision(
  supabase: SupabaseClient,
  approvalId: string,
  status: ApprovalStatus,
  options: { decided_by?: string; decision_reason?: string } = {}
) {
  const { data, error } = await supabase
    .from("approvals")
    .update({
      status,
      decided_by: options.decided_by ?? null,
      decided_at: new Date().toISOString(),
      decision_reason: options.decision_reason ?? null,
    })
    .eq("id", approvalId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as ApprovalRow | null;
}

export async function setApprovalExecuted(
  supabase: SupabaseClient,
  approvalId: string,
  executionResult: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("approvals")
    .update({
      status: "executed",
      executed_at: new Date().toISOString(),
      execution_result: executionResult,
    })
    .eq("id", approvalId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as ApprovalRow | null;
}

// ====== Audit log ======
export async function appendAudit(
  supabase: SupabaseClient,
  entry: {
    actor: string;
    actor_kind: ActorKind;
    event_type: string;
    subject_kind?: string;
    subject_id?: string;
    details?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("audit_log").insert({
    actor: entry.actor,
    actor_kind: entry.actor_kind,
    event_type: entry.event_type,
    subject_kind: entry.subject_kind ?? null,
    subject_id: entry.subject_id ?? null,
    details: entry.details ?? {},
  });
  if (error) throw error;
}

export async function listAudit(supabase: SupabaseClient): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}
