import { streamObject } from "ai";
import { azureConfigured, getInvestigatorModel } from "@/lib/ai/client";
import { SYSTEM_PROMPT, userPrompt } from "@/lib/ai/prompts";
import {
  investigationSchema,
  type InvestigationOutput,
} from "@/lib/ai/schema";
import type { SignInRow, UserRow } from "@/lib/db/types";
import { buildBaseline, type UserBaseline } from "@/lib/risk/baseline";
import { computeSignals } from "@/lib/risk/heuristics";
import { heuristicInvestigation } from "@/lib/ai/heuristic-fallback";

export interface InvestigationContext {
  signIn: SignInRow;
  user: UserRow;
  history: SignInRow[];
}

export function buildContext(ctx: InvestigationContext) {
  const baseline = buildBaseline(ctx.user, ctx.history);
  const signals = computeSignals(ctx.signIn, ctx.user);
  return { baseline, signals };
}

// Streaming AI investigation. Returns the `ai` SDK streamObject result so the
// caller can pipe it to `toTextStreamResponse()` / serve via `useObject`.
export function streamInvestigation(ctx: InvestigationContext) {
  const { baseline, signals } = buildContext(ctx);
  const model = getInvestigatorModel();
  return streamObject({
    model,
    schema: investigationSchema,
    schemaName: "Investigation",
    schemaDescription: "EntraGuard AI investigation output for a single sign-in event.",
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    prompt: userPrompt(ctx.signIn, baseline, signals),
  });
}

// Non-streaming fallback investigation. Returns a fully formed
// InvestigationOutput synchronously (well, async-shaped for symmetry).
export async function fallbackInvestigation(
  ctx: InvestigationContext
): Promise<{ output: InvestigationOutput; baseline: UserBaseline; model: string }> {
  const { baseline } = buildContext(ctx);
  const output = heuristicInvestigation(ctx.signIn, ctx.user, baseline);
  return { output, baseline, model: "heuristic-fallback" };
}

export function isAzureAvailable() {
  return azureConfigured();
}
