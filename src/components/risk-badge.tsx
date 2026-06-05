import { cn } from "@/lib/utils";

export type Verdict = "benign" | "suspicious" | "malicious";

export function verdictFromScore(score: number): Verdict {
  if (score >= 51) return "malicious";
  if (score >= 21) return "suspicious";
  return "benign";
}

export function RiskBadge({
  score,
  verdict,
  className,
}: {
  score?: number;
  verdict?: Verdict;
  className?: string;
}) {
  const v = verdict ?? (score !== undefined ? verdictFromScore(score) : null);
  if (!v) return null;
  const label = v.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        v === "malicious" &&
          "border-red-700/40 bg-red-600/15 text-red-300",
        v === "suspicious" &&
          "border-amber-600/40 bg-amber-500/15 text-amber-300",
        v === "benign" &&
          "border-emerald-700/40 bg-emerald-600/15 text-emerald-400",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          v === "malicious" && "bg-red-400",
          v === "suspicious" && "bg-amber-400",
          v === "benign" && "bg-emerald-400"
        )}
      />
      {score !== undefined ? `${score} · ${label}` : label}
    </span>
  );
}
