import {
  Activity,
  BookOpen,
  Brain,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersistedPhaseTiming } from "@/lib/db/types";

const PHASE_META: Record<
  PersistedPhaseTiming["phase"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  heuristic_signals: { label: "Heuristic signals", icon: Activity },
  knowledge_retrieval: { label: "Foundry IQ retrieval", icon: BookOpen },
  llm_reasoning: { label: "LLM reasoning", icon: Brain },
  action_synthesis: { label: "Action synthesis", icon: ListChecks },
};

export function ReasoningTrace({
  phases,
  className,
}: {
  phases: PersistedPhaseTiming[];
  className?: string;
}) {
  if (phases.length === 0) return null;
  const total = phases.reduce((sum, p) => sum + p.duration_ms, 0);
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Agent reasoning trace</h3>
        <span className="text-[11px] text-muted-foreground">
          total {total} ms · {phases.length} phases
        </span>
      </div>
      <ol className="relative space-y-3 border-l border-border pl-6">
        {phases.map((p, idx) => {
          const meta = PHASE_META[p.phase];
          const Icon = meta.icon;
          return (
            <li key={idx} className="relative">
              <span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border border-emerald-700/40 bg-emerald-600/15 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {meta.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  step {idx + 1} of {phases.length} · {p.duration_ms} ms
                </span>
              </div>
              {p.detail ? (
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {p.detail}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
