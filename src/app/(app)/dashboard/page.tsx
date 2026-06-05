import Link from "next/link";
import { ArrowRight, ShieldAlert, ShieldCheck, Inbox, Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge, verdictFromScore } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import {
  countryFlag,
  formatDateTime,
  relativeTime,
} from "@/lib/utils";
import { computeSignals, heuristicScore } from "@/lib/risk/heuristics";
import {
  listSignIns,
  listInvestigations,
  listPendingApprovals,
  listAudit,
} from "@/lib/db/queries";
import { InvestigateHeroButton } from "./investigate-hero-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [signIns, investigations, pending, audit] = await Promise.all([
    listSignIns(supabase),
    listInvestigations(supabase),
    listPendingApprovals(supabase),
    listAudit(supabase),
  ]);

  // Pre-flight heuristic score for un-investigated sign-ins so the priority
  // queue surfaces likely-bad events even before AI has run.
  const enriched = signIns.map((s) => ({
    sign_in: s,
    pre_score: heuristicScore(computeSignals(s, s.user)),
  }));

  const interactiveCount = signIns.filter((s) => s.is_interactive).length;
  const nonInteractiveCount = signIns.length - interactiveCount;
  const investigatedIds = new Set(
    investigations.map((i) => i.sign_in_id)
  );
  const flaggedCount = enriched.filter((e) => e.pre_score >= 21).length;
  const executedToday = audit.filter((a) => a.event_type === "action_executed")
    .length;

  // Hero sign-in = highest pre-flight score, preferring uninvestigated.
  const hero =
    enriched
      .filter((e) => !investigatedIds.has(e.sign_in.id))
      .sort((a, b) => b.pre_score - a.pre_score)[0] ?? enriched[0];

  const priorityQueue = enriched
    .filter((e) => !investigatedIds.has(e.sign_in.id))
    .sort((a, b) => b.pre_score - a.pre_score)
    .slice(0, 4);

  const recentActivity = audit.slice(0, 8);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Dashboard"
        subtitle="Identity threat investigation queue"
      />
      <div className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Sign-ins (24h)"
            value={signIns.length}
            sub={`${interactiveCount} interactive · ${nonInteractiveCount} background`}
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            label="Pre-flagged"
            value={flaggedCount}
            sub="Risk score ≥ 21 from heuristics"
            icon={<ShieldAlert className="h-4 w-4 text-amber-400" />}
          />
          <KpiCard
            label="Pending approvals"
            value={pending.length}
            sub="Awaiting human decision"
            icon={<Inbox className="h-4 w-4 text-blue-400" />}
          />
          <KpiCard
            label="Actions executed"
            value={executedToday}
            sub="Today, via simulated Graph"
            icon={<Bot className="h-4 w-4 text-emerald-400" />}
          />
        </div>

        {hero ? (
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
            <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Badge variant="info" className="text-[10px] tracking-widest">
                  TODAY&apos;S PRIORITY
                </Badge>
                <h2 className="text-xl font-semibold">
                  Review today&apos;s privileged sign-in activity
                </h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  EntraGuard pre-flagged{" "}
                  <span className="font-semibold text-foreground">
                    {hero.sign_in.user.display_name}
                  </span>{" "}
                  signing in from{" "}
                  <span className="font-semibold text-foreground">
                    {countryFlag(hero.sign_in.country)}{" "}
                    {hero.sign_in.city ?? hero.sign_in.country}
                  </span>{" "}
                  on a{" "}
                  {hero.sign_in.is_managed_device === false
                    ? "unmanaged "
                    : ""}
                  {hero.sign_in.device_os ?? "device"} at{" "}
                  {formatDateTime(hero.sign_in.created_at_event)}. Heuristics
                  score {hero.pre_score}/100 — let the agent investigate.
                </p>
              </div>
              <InvestigateHeroButton signInId={hero.sign_in.id} />
            </div>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold">Priority queue</h3>
              <Link
                href="/sign-ins"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                All sign-ins →
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {priorityQueue.map((row) => (
                <li
                  key={row.sign_in.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Link
                        href={`/sign-ins/${row.sign_in.id}`}
                        className="hover:text-primary"
                      >
                        {row.sign_in.user.display_name}
                      </Link>
                      {row.sign_in.user.is_privileged ? (
                        <Badge variant="warning" className="px-1.5 py-0">
                          {row.sign_in.user.privileged_role}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {countryFlag(row.sign_in.country)}{" "}
                      {row.sign_in.city ?? row.sign_in.country} ·{" "}
                      {row.sign_in.device_os ?? "—"} ·{" "}
                      {row.sign_in.application_display_name ?? "—"} ·{" "}
                      {formatDateTime(row.sign_in.created_at_event)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RiskBadge
                      score={row.pre_score}
                      verdict={verdictFromScore(row.pre_score)}
                    />
                    <Link href={`/sign-ins/${row.sign_in.id}`}>
                      <Button size="sm" variant="ghost" className="gap-1">
                        Inspect <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
              {priorityQueue.length === 0 ? (
                <li className="p-8 text-center text-sm text-muted-foreground">
                  All caught up — no un-investigated sign-ins.
                </li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold">Recent activity</h3>
              <Link
                href="/audit"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Audit log →
              </Link>
            </div>
            <ul className="divide-y divide-border text-xs">
              {recentActivity.map((entry) => (
                <li key={entry.id} className="space-y-1 px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {prettyEventType(entry.event_type)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(entry.created_at)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {entry.actor}
                  </div>
                </li>
              ))}
              {recentActivity.length === 0 ? (
                <li className="p-6 text-center text-muted-foreground">
                  No activity yet.
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}

function prettyEventType(t: string) {
  return t.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
