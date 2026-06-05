import { azureConfigured } from "@/lib/ai/client";
import type { SignInRow, UserRow } from "@/lib/db/types";
import { buildBaseline } from "@/lib/risk/baseline";
import { computeSignals } from "@/lib/risk/heuristics";

export interface InvestigationContext {
  signIn: SignInRow;
  user: UserRow;
  history: SignInRow[];
}

// Builds the per-investigation context — user baseline + heuristic signals.
// Used by the /api/investigate route which orchestrates retrieval + LLM.
export function buildContext(ctx: InvestigationContext) {
  const baseline = buildBaseline(ctx.user, ctx.history);
  const signals = computeSignals(ctx.signIn, ctx.user);
  return { baseline, signals };
}

export function isAzureAvailable() {
  return azureConfigured();
}
