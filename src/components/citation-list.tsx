import { BookOpen, ExternalLink, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersistedCitation } from "@/lib/db/types";

export function CitationList({
  citations,
  knowledgeSource,
  className,
}: {
  citations: PersistedCitation[];
  knowledgeSource: "foundry-iq" | "bundled-fallback" | null;
  className?: string;
}) {
  if (citations.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        No grounding sources were retrieved for this sign-in.
      </div>
    );
  }
  const usedCount = citations.filter((c) => c.why).length;
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-primary" />
          Knowledge sources
          <span className="text-xs font-normal text-muted-foreground">
            ({citations.length} retrieved · {usedCount} cited)
          </span>
        </div>
        <KnowledgeSourceBadge source={knowledgeSource} />
      </div>
      <ol className="space-y-2">
        {citations.map((c, i) => (
          <li
            key={c.source_id}
            className="rounded-lg border border-border bg-card/60 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    [{i + 1}]
                  </span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-medium hover:text-primary"
                  >
                    {c.title}
                  </a>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{c.publisher}</span>
                  <span>·</span>
                  <span>relevance {(c.score * 100).toFixed(0)}%</span>
                  {c.why ? (
                    <>
                      <span>·</span>
                      <span className="text-primary">cited by agent</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
                  {c.snippet}
                </p>
                {c.why ? (
                  <p className="mt-2 flex items-start gap-1.5 rounded bg-primary/10 px-2 py-1.5 text-[11px] text-primary/90">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{c.why}</span>
                  </p>
                ) : null}
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Open source"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function KnowledgeSourceBadge({
  source,
}: {
  source: "foundry-iq" | "bundled-fallback" | null;
}) {
  if (source === "foundry-iq") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Foundry IQ · live
      </span>
    );
  }
  if (source === "bundled-fallback") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Foundry IQ · bundled fallback
      </span>
    );
  }
  return null;
}
