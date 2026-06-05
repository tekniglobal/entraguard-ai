import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertOctagon,
  ChevronRight,
  Cpu,
  Sparkles,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getInvestigation,
  getSignIn,
  getActionsForInvestigation,
} from "@/lib/db/queries";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "@/components/risk-gauge";
import { RiskBadge } from "@/components/risk-badge";
import { TeamsAdaptiveCard } from "@/components/teams-adaptive-card";
import { TypewriterReasoning } from "@/components/typewriter-reasoning";
import { countryFlag, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvestigationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const investigation = await getInvestigation(supabase, id);
  if (!investigation) notFound();
  const signIn = await getSignIn(supabase, investigation.sign_in_id);
  if (!signIn) notFound();
  const actions = await getActionsForInvestigation(supabase, investigation.id);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Investigation"
        subtitle={`${signIn.user.display_name} · ${formatDateTime(signIn.created_at_event)}`}
      />
      <div className="flex-1 space-y-6 p-6">
        {/* Hero strip */}
        <Card className="overflow-hidden">
          <div className="grid gap-6 p-6 md:grid-cols-[minmax(200px,240px)_1fr]">
            <div className="flex flex-col items-center justify-center gap-3">
              <RiskGauge score={investigation.risk_score} />
              <RiskBadge verdict={investigation.verdict} />
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  EntraGuard AI
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Cpu className="h-3 w-3" />
                  {investigation.model}
                </Badge>
                {signIn.user.is_privileged ? (
                  <Badge variant="warning" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {signIn.user.privileged_role}
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {investigation.latency_ms ?? "—"} ms
                </Badge>
              </div>
              <h2 className="text-xl font-semibold leading-snug">
                {investigation.summary}
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                <Detail label="User" value={signIn.user.display_name} />
                <Detail
                  label="Location"
                  value={`${countryFlag(signIn.country)} ${signIn.city ?? signIn.country ?? "—"}`}
                />
                <Detail
                  label="Device"
                  value={`${signIn.device_os ?? "—"}${signIn.is_managed_device === false ? " · unmanaged" : ""}`}
                />
                <Detail label="MFA" value={signIn.mfa_detail ?? "—"} />
                <Detail
                  label="Client"
                  value={signIn.client_app ?? "—"}
                />
                <Detail
                  label="App"
                  value={signIn.application_display_name ?? "—"}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Reasoning + Actions */}
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">AI reasoning</h3>
            </div>
            <TypewriterReasoning
              text={investigation.reasoning}
              investigationId={investigation.id}
            />
            {investigation.signals.length > 0 ? (
              <div className="mt-6 border-t border-border pt-4">
                <h4 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Signals cited
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {investigation.signals.map((sig, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px]"
                    >
                      <span className="font-semibold">{sig.name}:</span>
                      <span className="text-muted-foreground">{sig.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <AlertOctagon className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold">
                Recommended actions{" "}
                <span className="text-muted-foreground">
                  ({actions.length})
                </span>
              </h3>
            </div>
            {actions.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No remediation recommended.
              </Card>
            ) : (
              <div className="space-y-3">
                {actions.map((action, idx) => (
                  <TeamsAdaptiveCard
                    key={action.id}
                    action={action}
                    signIn={signIn}
                    user={signIn.user}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="text-sm font-semibold">Raw Microsoft Graph response</h3>
            <Link
              href={`/sign-ins/${signIn.id}`}
              className="inline-flex items-center text-xs text-muted-foreground hover:text-primary"
            >
              Full sign-in <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <pre className="scrollbar-thin max-h-80 overflow-auto whitespace-pre p-4 text-[11px] leading-relaxed text-emerald-300/90">
{JSON.stringify(signIn.raw_json, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}
