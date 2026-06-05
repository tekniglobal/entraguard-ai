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
import {
  buildRetrievalQuery,
  foundryConfigured,
  retrieveGrounding,
} from "@/lib/foundry/retrieve";
import type {
  PersistedCitation,
  PersistedPhaseTiming,
} from "@/lib/db/types";

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

  const phaseTimings: PersistedPhaseTiming[] = [];
  const overallStarted = Date.now();

  // ───── Phase 1: Heuristic signals ─────
  const phase1Started = Date.now();
  const history = await getSignInHistory(supabase, signIn.user_id, signIn.id);
  const ctx = { signIn, user: signIn.user, history };
  const { baseline, signals } = buildContext(ctx);
  phaseTimings.push({
    phase: "heuristic_signals",
    started_at: new Date(phase1Started).toISOString(),
    duration_ms: Date.now() - phase1Started,
    detail: `Computed ${countActive(signals)} active signals against ${baseline.sign_ins_observed_last_30d}-event baseline`,
  });

  // ───── Phase 2: Knowledge retrieval (Foundry IQ) ─────
  const phase2Started = Date.now();
  const query = buildRetrievalQuery(
    signIn.user.display_name,
    signIn.user.privileged_role,
    signals
  );
  const retrieval = await retrieveGrounding(query, signals, { maxResults: 4 });
  phaseTimings.push({
    phase: "knowledge_retrieval",
    started_at: new Date(phase2Started).toISOString(),
    duration_ms: Date.now() - phase2Started,
    detail: `${retrieval.knowledge_source} returned ${retrieval.citations.length} sources`,
  });

  // ───── Phase 3: LLM reasoning ─────
  const phase3Started = Date.now();
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
        prompt: userPrompt(signIn, baseline, signals, retrieval.citations),
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
      output = heuristicInvestigation(
        signIn,
        signIn.user,
        baseline,
        retrieval.citations
      );
    }
  } else {
    output = heuristicInvestigation(
      signIn,
      signIn.user,
      baseline,
      retrieval.citations
    );
  }
  phaseTimings.push({
    phase: "llm_reasoning",
    started_at: new Date(phase3Started).toISOString(),
    duration_ms: Date.now() - phase3Started,
    detail: `Model: ${modelUsed} · verdict: ${output.verdict} · score: ${output.risk_score}`,
  });

  // ───── Phase 4: Action synthesis (already done by the model — record the step for the trace) ─────
  const phase4Started = Date.now();
  phaseTimings.push({
    phase: "action_synthesis",
    started_at: new Date(phase4Started).toISOString(),
    duration_ms: Date.now() - phase4Started,
    detail: `${output.recommended_actions.length} action(s) proposed`,
  });

  // Merge model's chosen citations into the retrieved set
  const citationsToPersist: PersistedCitation[] = retrieval.citations.map(
    (c) => {
      const used = output.citations_used.find(
        (u) => u.source_id === c.source_id
      );
      return {
        source_id: c.source_id,
        title: c.title,
        publisher: c.publisher,
        url: c.url,
        snippet: c.snippet,
        score: c.score,
        why: used?.why,
      };
    }
  );

  const latencyMs = Date.now() - overallStarted;

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
      citations: citationsToPersist,
      phase_timings: phaseTimings,
      knowledge_source: retrieval.knowledge_source,
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

  // Audit retrieval as its own line so the audit log shows the agentic-RAG step explicitly
  await appendAudit(supabase, {
    actor: "agent:entraguard",
    actor_kind: "agent",
    event_type: "knowledge_retrieved",
    subject_kind: "investigation",
    subject_id: invRow.id,
    details: {
      source: retrieval.knowledge_source,
      query,
      citations: retrieval.citations.map((c) => ({
        source_id: c.source_id,
        title: c.title,
        publisher: c.publisher,
        score: c.score,
      })),
      latency_ms: retrieval.latency_ms,
      foundry_configured: foundryConfigured(),
    },
  });

  // Audit the completion
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
      knowledge_source: retrieval.knowledge_source,
      citations_used: output.citations_used.length,
    },
  });

  return NextResponse.json({
    investigationId: invRow.id,
    cached: false,
    model: modelUsed,
    knowledge_source: retrieval.knowledge_source,
  });
}

function countActive(s: ReturnType<typeof buildContext>["signals"]): number {
  let n = 0;
  if (s.user_is_privileged) n++;
  if (s.geo_unusual) n++;
  if (s.off_hours) n++;
  if (s.device_unmanaged) n++;
  if (s.legacy_auth) n++;
  if (s.tor_or_anon_ip) n++;
  if (!s.mfa_satisfied && !s.is_non_interactive) n++;
  if (s.failed_auth) n++;
  if (s.is_non_interactive) n++;
  return n;
}
