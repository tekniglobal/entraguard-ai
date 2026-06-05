import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignIn, getSignInHistory, appendAudit } from "@/lib/db/queries";
import { isAzureAvailable, buildContext } from "@/lib/ai/investigate";
import { getInvestigatorModel } from "@/lib/ai/client";
import { SYSTEM_PROMPT, userPrompt } from "@/lib/ai/prompts";
import { investigationSchema } from "@/lib/ai/schema";
import { heuristicInvestigation } from "@/lib/ai/heuristic-fallback";
import type { InvestigationOutput } from "@/lib/ai/schema";

const requestSchema = z.object({
  signInId: z.string().uuid(),
  mode: z.enum(["create", "rerun"]).default("create"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { signInId, mode } = parsed.data;

  const supabase = createAdminClient();
  const signIn = await getSignIn(supabase, signInId);
  if (!signIn) {
    return NextResponse.json({ error: "sign-in not found" }, { status: 404 });
  }

  // Cache: return existing investigation if present and mode=create.
  if (mode === "create" && process.env.DEMO_USE_CACHE !== "false") {
    const { data: existing } = await supabase
      .from("investigations")
      .select("id")
      .eq("sign_in_id", signInId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return NextResponse.json({ investigationId: existing.id, cached: true });
    }
  }

  const history = await getSignInHistory(supabase, signIn.user_id, signIn.id);
  const ctx = { signIn, user: signIn.user, history };
  const { baseline, signals } = buildContext(ctx);

  const started = Date.now();
  let output: InvestigationOutput;
  let modelUsed = "heuristic-fallback";
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;

  if (isAzureAvailable()) {
    try {
      const result = await generateObject({
        model: getInvestigatorModel(),
        schema: investigationSchema,
        schemaName: "Investigation",
        schemaDescription:
          "EntraGuard AI investigation output for a single sign-in event.",
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        prompt: userPrompt(signIn, baseline, signals),
      });
      output = result.object;
      modelUsed = process.env.AZURE_OPENAI_DEPLOYMENT || "azure-openai";
      promptTokens = result.usage?.promptTokens ?? null;
      completionTokens = result.usage?.completionTokens ?? null;
    } catch (err) {
      if (process.env.DEMO_FALLBACK_ON_ERROR === "false") {
        return NextResponse.json(
          { error: (err as Error).message },
          { status: 502 }
        );
      }
      output = heuristicInvestigation(signIn, signIn.user, baseline);
    }
  } else {
    output = heuristicInvestigation(signIn, signIn.user, baseline);
  }

  const latencyMs = Date.now() - started;

  // Persist investigation
  const { data: invRow, error: invErr } = await supabase
    .from("investigations")
    .insert({
      sign_in_id: signIn.id,
      risk_score: output.risk_score,
      verdict: output.verdict,
      summary: output.summary,
      reasoning: output.reasoning,
      signals: output.signals_cited,
      model: modelUsed,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      latency_ms: latencyMs,
      cached: false,
    })
    .select("*")
    .single();
  if (invErr || !invRow) {
    return NextResponse.json(
      { error: invErr?.message ?? "failed to insert investigation" },
      { status: 500 }
    );
  }

  // Persist actions + pending approvals
  if (output.recommended_actions.length > 0) {
    const actionRows = output.recommended_actions.map((a, idx) => ({
      investigation_id: invRow.id,
      action_type: a.action_type,
      rationale: a.rationale,
      severity: a.severity,
      order_index: idx,
    }));
    const { data: insertedActions, error: actionErr } = await supabase
      .from("recommended_actions")
      .insert(actionRows)
      .select("*");
    if (actionErr) {
      return NextResponse.json({ error: actionErr.message }, { status: 500 });
    }
    const approvalRows = (insertedActions ?? []).map((a) => ({
      action_id: a.id,
      status: "pending" as const,
    }));
    if (approvalRows.length > 0) {
      const { error: approvalErr } = await supabase
        .from("approvals")
        .insert(approvalRows);
      if (approvalErr) {
        return NextResponse.json(
          { error: approvalErr.message },
          { status: 500 }
        );
      }
    }
  }

  // Audit
  await appendAudit(supabase, {
    actor: "agent:entraguard",
    actor_kind: "agent",
    event_type: "investigation_completed",
    subject_kind: "investigation",
    subject_id: invRow.id,
    details: {
      sign_in_id: signIn.id,
      risk_score: output.risk_score,
      verdict: output.verdict,
      model: modelUsed,
      actions_recommended: output.recommended_actions.length,
      latency_ms: latencyMs,
    },
  });

  return NextResponse.json({
    investigationId: invRow.id,
    cached: false,
    model: modelUsed,
  });
}
