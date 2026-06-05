import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appendAudit,
  setApprovalDecision,
  setApprovalExecuted,
} from "@/lib/db/queries";
import { simulate } from "@/lib/remediation/simulators";

const bodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const operator =
    process.env.DEMO_OPERATOR_EMAIL ?? "operator@contoso.com";

  // Decide
  const newStatus = parsed.data.decision === "approve" ? "approved" : "rejected";
  const updated = await setApprovalDecision(supabase, id, newStatus, {
    decided_by: operator,
    decision_reason: parsed.data.reason,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "approval not found" },
      { status: 404 }
    );
  }

  // Audit the decision
  await appendAudit(supabase, {
    actor: operator,
    actor_kind: "human",
    event_type: "approval_decided",
    subject_kind: "approval",
    subject_id: updated.id,
    details: { decision: parsed.data.decision, reason: parsed.data.reason ?? null },
  });

  // If approved, run the simulator and mark executed
  if (parsed.data.decision === "approve") {
    // Need user + action context for the simulator payload
    const { data: actionData } = await supabase
      .from("recommended_actions")
      .select("*, investigation:investigations(sign_in:sign_ins(user:users(*)))")
      .eq("id", updated.action_id)
      .single();
    const user = (actionData as any)?.investigation?.sign_in?.user;
    if (!actionData || !user) {
      return NextResponse.json(
        { error: "context for simulation missing" },
        { status: 500 }
      );
    }
    const simResult = simulate(actionData.action_type, user);
    const executed = await setApprovalExecuted(supabase, id, simResult as any);
    await appendAudit(supabase, {
      actor: "system:graph-simulator",
      actor_kind: "system",
      event_type: "action_executed",
      subject_kind: "approval",
      subject_id: updated.id,
      details: simResult as any,
    });
    return NextResponse.json({ approval: executed, simulation: simResult });
  }

  return NextResponse.json({ approval: updated });
}
